/**
 * خدمة نقطة البيع — PHASE 31 · أقسام 16 و17 و68.
 * هذه هي الواجهة التي تستدعيها شاشة الكاشير: عملية واحدة (checkout)
 * تنفّذ التدفّق الكامل عبر خدمات المجالات، بترتيب يضمن عدم ترك النظام
 * في حالة نصفية: الفاتورة أولًا، ثم الدفع، ثم خصم المخزون، ثم الإيصال.
 */
import {
  BusinessRuleError,
  NotFoundError,
  failure,
  money,
  success,
  systemClock,
  type AsyncResult,
  type Clock,
  type CurrencyCode,
  type PaginatedResult,
  type ProductId,
  type Result,
  type SDKContextStore,
} from '@/sdk/core';
import { assertCheckoutReady, type CartService, type Discount } from '@/sdk/cart';
import type { InventoryService } from '@/sdk/inventory';
import type { PaymentService } from '@/sdk/payments';
import type { SaleRepository, SaleService } from '@/sdk/sales';
import type { Product, ProductListQuery, ProductRepository } from '@/sdk/products';
import type { CheckoutCommand, CheckoutResult, PosSnapshot } from '../contracts/pos-contracts';

// الواجهة العلنية لخدمة نقطة البيع (sdk.pos).
export interface PosService {
  // لقطة الحالة الحالية للشاشة.
  snapshot(): PosSnapshot;
  // يبحث في منتجات المتجر النشط (نص البحث اختياري — بدونه يسرد الكل).
  search(query?: ProductListQuery & { term?: string }): AsyncResult<PaginatedResult<Product>>;
  // يمسح باركودًا ويضيف المنتج مباشرة للسلة.
  scanBarcode(barcode: string): AsyncResult<Product>;
  // يضيف منتجًا للسلة.
  addToCart(productId: ProductId, quantity?: number): AsyncResult<PosSnapshot>;
  // يزيل منتجًا من السلة.
  removeFromCart(productId: ProductId): Result<PosSnapshot>;
  // يعدّل كمية بند.
  setQuantity(productId: ProductId, quantity: number): Result<PosSnapshot>;
  // يطبّق خصمًا.
  applyDiscount(discount: Discount, productId?: ProductId): Result<PosSnapshot>;
  // يفرّغ السلة.
  clearCart(): PosSnapshot;
  // ينفّذ البيع الكامل (فاتورة + دفع + مخزون + إيصال).
  checkout(command: CheckoutCommand): AsyncResult<CheckoutResult>;
}

// تبعيات الخدمة (كلها واجهات — لا تنفيذ ملموس).
export interface PosServiceDependencies {
  readonly cart: CartService; // خدمة السلة.
  readonly sales: SaleService; // خدمة المبيعات.
  readonly salesRepository: SaleRepository; // مستودع الفواتير (للإيصال).
  readonly payments: PaymentService; // خدمة المدفوعات.
  readonly inventory: InventoryService; // خدمة المخزون.
  readonly products: ProductRepository; // مستودع المنتجات.
  readonly contextStore: SDKContextStore; // السياق.
  readonly clock?: Clock; // الساعة.
}

// ينشئ خدمة نقطة البيع بالحقن الكامل.
export const createPosService = (deps: PosServiceDependencies): PosService => {
  // لا ساعة هنا عمدًا: نقطة البيع تنسّق ولا تختم وقتًا — كل ختم زمني
  // يقع في الخدمة المالكة للكيان (المبيعات/المدفوعات/المخزون) بساعتها
  // المحقونة، فيبقى مصدر الوقت واحدًا لكل كيان.

  // يبني لقطة الحالة من السلة الحالية.
  const buildSnapshot = (): PosSnapshot => {
    // السلة الحالية (مطابقة للسياق).
    const cart = deps.cart.current();
    // إجمالياتها المحسوبة.
    const totals = deps.cart.calculate();
    // اللقطة الجاهزة للعرض.
    return {
      cart,
      totals,
      currency: cart.currency,
      // البيع ممكن متى كانت السلة غير فارغة وإجماليها موجب.
      canCheckout: !totals.isEmpty && totals.total.amount > 0,
      availableMethods: deps.payments.availableMethods(),
    };
  };

  return {
    // ── اللقطة ──
    snapshot: () => buildSnapshot(),

    // ── البحث ──
    search: async (query) => {
      // نص البحث إن وُجد.
      const term = query?.term?.trim() ?? '';
      // بلا نص نسرد المنتجات؛ مع نص نستخدم مسار البحث.
      return term.length === 0
        ? deps.products.list(query)
        : deps.products.search({ ...query, term });
    },

    // ── مسح الباركود ──
    scanBarcode: async (barcode) => {
      // نقرأ المنتج بالباركود (مطابقة تامة).
      const found = await deps.products.getByBarcode({ barcode });
      // فشل القراءة يُمرَّر كما هو.
      if (!found.success) return found;
      // عدم التطابق ليس خطأ مستودع لكنه خطأ عملية في نقطة البيع.
      if (found.data === null) return failure(new NotFoundError('product', barcode));
      // المنتج الموجود.
      const product = found.data;
      // نضيفه للسلة فورًا (سلوك الماسح المتوقّع).
      const added = await deps.cart.addItem(product.id, 1);
      // فشل الإضافة (رصيد/عملة) يُعاد.
      if (!added.success) return added;
      // المنتج الممسوح.
      return success(product);
    },

    // ── الإضافة ──
    addToCart: async (productId, quantity = 1) => {
      // نضيف عبر خدمة السلة (تفرض قواعد الرصيد والعملة).
      const result = await deps.cart.addItem(productId, quantity);
      // الفشل يُمرَّر.
      if (!result.success) return result;
      // لقطة محدّثة.
      return success(buildSnapshot());
    },

    // ── الإزالة ──
    removeFromCart: (productId) => {
      // نزيل البند.
      const result = deps.cart.removeItem(productId);
      // الفشل يُمرَّر ونجاحه يُعيد لقطة.
      return result.success ? success(buildSnapshot()) : result;
    },

    // ── تعديل الكمية ──
    setQuantity: (productId, quantity) => {
      // نعدّل الكمية.
      const result = deps.cart.updateQuantity(productId, quantity);
      // النتيجة كلقطة.
      return result.success ? success(buildSnapshot()) : result;
    },

    // ── الخصم ──
    applyDiscount: (discount, productId) => {
      // نطبّق الخصم.
      const result = deps.cart.applyDiscount(discount, productId);
      // النتيجة كلقطة.
      return result.success ? success(buildSnapshot()) : result;
    },

    // ── التفريغ ──
    clearCart: () => {
      // نفرّغ السلة.
      deps.cart.clear();
      // لقطة فارغة.
      return buildSnapshot();
    },

    // ── البيع الكامل ──
    checkout: async (command) => {
      // (1) السلة الحالية وجاهزيتها.
      const cart = deps.cart.current();
      // نتحقق أنها قابلة للتحويل لفاتورة.
      const ready = assertCheckoutReady(cart);
      if (!ready.success) return ready;
      // الإجماليات المؤكدة.
      const totals = ready.data;

      // (2) قاعدة عمل مسبقة: نتأكد أن كل بند ما زال متوفرًا بالكمية المطلوبة.
      // (فحص استباقي يمنع إنشاء فاتورة يتعذّر خصم مخزونها.)
      for (const item of cart.items) {
        // نقرأ مستوى المخزون الحالي للمنتج.
        const level = await deps.inventory.getLevel(item.productId);
        // تعذّر القراءة لا يُوقف البيع (قد يكون المنتج بلا سجل مخزون بعد).
        if (level.success && level.data.quantity < item.quantity) {
          // الرصيد لم يعد كافيًا — نُوقف قبل أي كتابة.
          return failure(
            new BusinessRuleError('sdk.pos.error.stockChanged', {
              details: {
                productId: String(item.productId),
                requested: item.quantity,
                available: level.data.quantity,
              },
            }),
          );
        }
      }

      // (3) ننشئ الفاتورة من السلة (تفرض الخدمة التفويض والتدقيق).
      const sale = await deps.sales.createFromCart(cart, {
        customerName: command.customerName,
        cashierName: command.cashierName,
      });
      // فشل الإنشاء يُوقف كل شيء (لا دفع بلا فاتورة).
      if (!sale.success) return sale;

      // (4) نعالج الدفع على الفاتورة.
      const payment = await deps.payments.process({
        saleId: sale.data.id,
        method: command.method,
        amount: totals.total.amount,
        tendered: command.tendered,
        splits: command.splits,
        reference: command.reference,
      });
      // فشل الدفع يُعاد؛ الفاتورة تبقى "بانتظار الدفع" فيمكن إعادة المحاولة أو إلغاؤها.
      if (!payment.success) return payment;

      // (5) نخصم المخزون لكل بند بعد نجاح التحصيل (لا قبله).
      for (const line of sale.data.lines) {
        // خصم كمية البند مع ربطه برقم الفاتورة للتتبّع.
        const deducted = await deps.inventory.deductForSale({
          productId: line.productId,
          quantity: line.quantity,
          reference: sale.data.saleNumber,
        });
        // فشل الخصم يُسجَّل كخطأ صريح: الدفع تم والمخزون لم يُخصم.
        // نُعيد الخطأ ليعالجه المشغّل يدويًا بدل إخفائه.
        if (!deducted.success) {
          return failure(
            new BusinessRuleError('sdk.pos.error.stockDeductionFailed', {
              details: {
                saleId: String(sale.data.id),
                paymentId: String(payment.data.id),
                productId: String(line.productId),
              },
            }),
          );
        }
      }

      // (6) نبني الإيصال من المستودع.
      const receipt = await deps.salesRepository.getReceipt(sale.data.id);
      // فشل الإيصال لا يُبطل البيع لكنه يُعاد كخطأ ليُعاد توليده.
      if (!receipt.success) return receipt;

      // (7) نفرّغ السلة بعد اكتمال العملية.
      deps.cart.clear();

      // (8) النتيجة الكاملة.
      return success({
        sale: sale.data,
        payment: payment.data,
        receipt: receipt.data,
        // الباقي من الدفعة (صفر في غير النقد).
        change: money(payment.data.change.amount, payment.data.currency),
      });
    },
  };
};

// يبني جلسة نقطة بيع جديدة (وردية) — دالة نقية.
export const openPosSession = (input: {
  readonly storeId: string; // المتجر.
  readonly cashierName: string; // الكاشير.
  readonly openingFloat: number; // النقد الافتتاحي.
  readonly currency: CurrencyCode; // العملة (نوع مُقيَّد لا نص حر).
  readonly clock?: Clock; // الساعة.
}) => {
  // الساعة المستخدمة.
  const clock = input.clock ?? systemClock;
  // لحظة الفتح.
  const now = clock.now();
  // الجلسة المفتوحة.
  return {
    id: `pos-${clock.timestamp().toString(36)}`,
    storeId: input.storeId,
    cashierName: input.cashierName,
    status: 'open' as const,
    openingFloat: money(input.openingFloat, input.currency),
    openedAt: now,
    salesCount: 0,
    salesTotal: money(0, input.currency),
  };
};
