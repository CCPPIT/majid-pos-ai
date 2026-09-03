/**
 * خدمة السلة — PHASE 31 · أقسام 14 و35 و54.
 * الخدمة تدير سلة نشطة واحدة لكل جلسة/متجر فوق المحرّك النقي.
 * ملاحظة معمارية: الـSDK لا يعتمد على Zustand ولا على أي حالة واجهة؛
 * المتجر الحالي يُحفظ داخل الخدمة، وطبقة الواجهة تشترك في تغيّراته.
 */
import {
  BusinessRuleError,
  failure,
  success,
  systemClock,
  type AsyncResult,
  type Clock,
  type ProductId,
  type Result,
  type SDKContextStore,
} from '@/sdk/core';
import type { ProductRepository } from '@/sdk/products';
import type { TenancyService } from '@/sdk/tenancy';
import type { Cart, CartTotals, Discount } from '../contracts/cart-contracts';
import {
  addItem,
  applyDiscount,
  clearCart,
  createCart,
  removeDiscount,
  removeItem,
  updateQuantity,
} from '../commands/cart-engine';
import { calculateTotals } from '../calculations/cart-calculator';

// الواجهة العلنية لخدمة السلة (sdk.cart).
export interface CartService {
  // ينشئ سلة جديدة للمتجر النشط (يستبدل القائمة).
  create(): Result<Cart>;
  // يقرأ السلة الحالية (ينشئها إن لم توجد).
  current(): Cart;
  // يضيف منتجًا بالمعرّف (يقرأ سعره ورصيده من المستودع).
  addItem(productId: ProductId, quantity?: number): AsyncResult<Cart>;
  // يزيل بندًا.
  removeItem(productId: ProductId): Result<Cart>;
  // يعيّن كمية بند.
  updateQuantity(productId: ProductId, quantity: number): Result<Cart>;
  // يطبّق خصمًا (على السلة أو على بند).
  applyDiscount(discount: Discount, productId?: ProductId): Result<Cart>;
  // يزيل خصمًا.
  removeDiscount(productId?: ProductId): Result<Cart>;
  // يحسب الإجماليات الحالية (حتمي).
  calculate(): CartTotals;
  // يفرّغ السلة.
  clear(): Cart;
  // يشترك في تغيّرات السلة (تستخدمه طبقة الواجهة).
  subscribe(listener: (cart: Cart) => void): () => void;
}

// تبعيات الخدمة.
export interface CartServiceDependencies {
  readonly products: ProductRepository; // مصدر أسعار المنتجات وأرصدتها.
  readonly tenancy: TenancyService; // حراسة المتجر النشط.
  readonly contextStore: SDKContextStore; // السياق (عملة/متجر/مستأجر).
  readonly clock?: Clock; // ساعة قابلة للحقن.
  readonly defaultTaxRatePercent?: number; // نسبة الضريبة الافتراضية.
}

// ينشئ خدمة السلة بالحقن.
export const createCartService = (deps: CartServiceDependencies): CartService => {
  // الساعة المستخدمة.
  const clock = deps.clock ?? systemClock;
  // نسبة الضريبة الافتراضية حين لا يوفّرها المتجر.
  const defaultTax = deps.defaultTaxRatePercent ?? 0;
  // مجموعة المشتركين في تغيّر السلة.
  const listeners = new Set<(cart: Cart) => void>();
  // السلة النشطة الحالية.
  let cart: Cart = createCart({
    currency: deps.contextStore.get().currency,
    taxRatePercent: defaultTax,
    storeId: deps.contextStore.get().storeId,
    tenantId: deps.contextStore.get().tenantId,
    clock,
  });

  // يخطر المشتركين بالسلة الحالية.
  const notify = (): void => {
    // نمرّ على نسخة من المجموعة ليصح إلغاء الاشتراك أثناء الإخطار.
    for (const listener of [...listeners]) listener(cart);
  };

  // يحفظ السلة الجديدة ويخطر المشتركين.
  const commit = (next: Cart): Cart => {
    cart = next;
    notify();
    return cart;
  };

  // يضمن أن السلة تطابق المتجر والعملة الحاليين (تُصفَّر عند التبديل).
  const ensureFresh = (): Cart => {
    // السياق الحالي.
    const context = deps.contextStore.get();
    // هل تبدّل المتجر؟
    const storeChanged = String(cart.storeId ?? '') !== String(context.storeId ?? '');
    // هل تبدّلت العملة؟
    const currencyChanged = cart.currency !== context.currency;
    // أي تبدّل يعني سلة جديدة (لا نخلط بيانات متجرين).
    if (storeChanged || currencyChanged) {
      // نبني سلة جديدة بالسياق الحالي.
      cart = createCart({
        currency: context.currency,
        taxRatePercent: cart.taxRatePercent || defaultTax,
        storeId: context.storeId,
        tenantId: context.tenantId,
        clock,
      });
    }
    // السلة المطابقة للسياق.
    return cart;
  };

  return {
    // إنشاء سلة جديدة صراحةً.
    create: () => {
      // نحرس وجود متجر نشط (لا بيع بلا متجر).
      const guarded = deps.tenancy.requireStore();
      if (!guarded.success) return guarded;
      // السياق الحالي.
      const context = deps.contextStore.get();
      // نبني السلة ونثبتها.
      return success(
        commit(
          createCart({
            currency: context.currency,
            taxRatePercent: defaultTax,
            storeId: context.storeId,
            tenantId: context.tenantId,
            clock,
          }),
        ),
      );
    },

    // السلة الحالية (مطابقة للسياق دائمًا).
    current: () => ensureFresh(),

    // إضافة منتج بالمعرّف.
    addItem: async (productId, quantity = 1) => {
      // حراسة المتجر النشط.
      const guarded = deps.tenancy.requireStore();
      if (!guarded.success) return guarded;
      // نقرأ المنتج من المستودع (سعره ورصيده الحقيقيان).
      const product = await deps.products.get(productId);
      // فشل القراءة يُمرَّر كما هو (NotFound مثلًا).
      if (!product.success) return product;
      // نطبّق قاعدة الإضافة على سلة مطابقة للسياق.
      const result = addItem(ensureFresh(), product.data, quantity, clock);
      // الفشل يُمرَّر.
      if (!result.success) return result;
      // النجاح يُثبَّت ويُخطَر به.
      return success(commit(result.data));
    },

    // إزالة بند.
    removeItem: (productId) => {
      // نطبّق العملية على السلة الحالية.
      const result = removeItem(ensureFresh(), productId, clock);
      // نثبّت عند النجاح فقط.
      return result.success ? success(commit(result.data)) : result;
    },

    // تعيين كمية.
    updateQuantity: (productId, quantity) => {
      // نطبّق العملية.
      const result = updateQuantity(ensureFresh(), productId, quantity, clock);
      // نثبّت عند النجاح.
      return result.success ? success(commit(result.data)) : result;
    },

    // تطبيق خصم.
    applyDiscount: (discount, productId) => {
      // نطبّق العملية.
      const result = applyDiscount(ensureFresh(), discount, productId, clock);
      // نثبّت عند النجاح.
      return result.success ? success(commit(result.data)) : result;
    },

    // إزالة خصم.
    removeDiscount: (productId) => {
      // نطبّق العملية.
      const result = removeDiscount(ensureFresh(), productId, clock);
      // نثبّت عند النجاح.
      return result.success ? success(commit(result.data)) : result;
    },

    // حساب الإجماليات (حتمي، بلا آثار جانبية).
    calculate: () => calculateTotals(ensureFresh()),

    // تفريغ السلة.
    clear: () => commit(clearCart(ensureFresh(), clock)),

    // الاشتراك في التغيّرات.
    subscribe: (listener) => {
      // نسجّل المشترك.
      listeners.add(listener);
      // ونُعيد دالة الإلغاء.
      return () => listeners.delete(listener);
    },
  };
};

// يتحقق أن السلة جاهزة للدفع (غير فارغة وإجماليها موجب) — قاعدة مشتركة.
export const assertCheckoutReady = (cart: Cart): Result<CartTotals> => {
  // نحسب الإجماليات.
  const totals = calculateTotals(cart);
  // سلة فارغة لا يمكن تحويلها لفاتورة.
  if (totals.isEmpty) return failure(new BusinessRuleError('sdk.cart.error.EMPTY_CART'));
  // إجمالي غير موجب يعني خطأ تسعير/خصم.
  if (totals.total.amount <= 0) return failure(new BusinessRuleError('sdk.cart.error.INVALID_TOTAL'));
  // جاهزة للدفع.
  return success(totals);
};
