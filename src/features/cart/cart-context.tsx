/**
 * مزود سلة البيع (PHASE 12 — Cart Engine).
 * يلف محرك المجال النقي (domain/cart) بحالة React: يستمد العملة ونسبة الضريبة
 * والمتجر النشط من سياق الاستئجار، ويُعيد سلة تُصفَّر عند تغيّر المتجر.
 * الإجراءات تُرجع نتيجة (نجاح/سبب الخطأ) لترسم الواجهة رسالة محلية.
 */
import {
  createContext, // لإنشاء السياق.
  useCallback, // لتثبيت الدوال.
  useContext, // للقراءة من السياق.
  useMemo, // لحساب القيم المشتقة.
  useState, // لحالة السلة.
  type ReactNode, // نوع الأبناء.
} from 'react';

import { ValidationError } from '@/core/errors/AppError';
import type { ID } from '@/core/types/domain';
import {
  addItem, // إضافة منتج.
  computeTotals, // حساب الإجماليات.
  decrementItem as decLine, // إنقاص كمية.
  emptyCart, // سلة فارغة (تُستخدم للتصفير أيضًا).
  incrementItem as incLine, // زيادة كمية.
  removeItem as removeLine, // إزالة بند.
  setDiscount as applyDiscount, // تعيين خصم.
  setQuantity as applyQuantity, // تعيين كمية.
  type Cart, // نوع السلة.
  type CartErrorReason, // سبب الخطأ.
  type CartTotals, // الإجماليات.
} from '@/domain/cart';
import type { Product } from '@/domain/products/types';
import { useTenancy } from '@/features/tenancy/tenancy-context';

// نتيجة إجراء على السلة (تنجح أو تفشل بسبب قاعدة عمل).
export type CartActionResult = { ok: true } | { ok: false; reason: CartErrorReason };

// قيم السياق المعروضة.
export interface CartContextValue {
  cart: Cart; // السلة الحالية (مطابقة للمتجر النشط).
  totals: CartTotals; // الإجماليات المالية.
  currency: string; // عملة السلة.
  taxRatePercent: number; // نسبة ضريبة المتجر.
  add: (product: Product, quantity?: number) => CartActionResult; // إضافة.
  increment: (productId: ID) => CartActionResult; // زيادة كمية.
  decrement: (productId: ID) => CartActionResult; // إنقاص كمية.
  setQuantity: (productId: ID, quantity: number) => CartActionResult; // تعيين كمية.
  remove: (productId: ID) => CartActionResult; // إزالة بند.
  applyDiscountPercent: (percent: number) => CartActionResult; // خصم إجمالي.
  clear: () => void; // تصفير (بعد البيع).
  findQuantity: (productId: ID) => number; // كمية منتج في السلة (للواجهة).
}

// السياق نفسه (null خارج المزود).
const CartContext = createContext<CartContextValue | null>(null);

// يستخرج سبب خطأ قاعدة السلة من الاستثناء.
function reasonOf(error: unknown): CartErrorReason {
  if (error instanceof ValidationError) {
    // ValidationError يحمل `fields` (Record<string,string>) ونضع فيه السبب.
    const reason = error.fields?.reason as CartErrorReason | undefined;
    if (reason) return reason;
  }
  return 'INVALID_QUANTITY';
}

export function CartProvider({ children }: { children: ReactNode }) {
  const tenancy = useTenancy(); // سياق المستأجر.
  const currency = tenancy.context?.currency ?? 'YER'; // عملة المتجر.
  const taxRatePercent = tenancy.context?.taxRatePercent ?? 0; // ضريبة المتجر.
  const storeId = tenancy.context?.storeId; // المتجر النشط.

  // حالة السلة (تبدأ فارغة بالعملة الافتراضية حتى اكتمال التحميل).
  const [cart, setCart] = useState<Cart>(() => emptyCart(currency, storeId));

  // سلة فعّالة مطابقة للمتجر النشط (تُصفَّر عند تغيّر المتجر/العملة دون effect).
  const effectiveCart: Cart = useMemo(() => {
    const storeChanged = storeId && cart.storeId && String(cart.storeId) !== String(storeId);
    const currencyChanged = cart.currency !== currency;
    if (storeChanged || currencyChanged) return emptyCart(currency, storeId);
    return cart;
  }, [cart, storeId, currency]);

  // الإجماليات تُحسب حصريًا في المجال (core/money).
  const totals = useMemo(
    () => computeTotals(effectiveCart, taxRatePercent),
    [effectiveCart, taxRatePercent],
  );

  // إضافة منتج (تلتقط أخطاء المخزون/العملة).
  const add = useCallback(
    (product: Product, quantity: number = 1): CartActionResult => {
      try {
        setCart(addItem(effectiveCart, product, quantity));
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: reasonOf(error) };
      }
    },
    [effectiveCart],
  );

  // زيادة كمية بند بمقدار واحد.
  const increment = useCallback(
    (productId: ID): CartActionResult => {
      try {
        setCart(incLine(effectiveCart, productId));
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: reasonOf(error) };
      }
    },
    [effectiveCart],
  );

  // إنقاص كمية بند بمقدار واحد (يُزال عند الصفر).
  const decrement = useCallback(
    (productId: ID): CartActionResult => {
      try {
        setCart(decLine(effectiveCart, productId));
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: reasonOf(error) };
      }
    },
    [effectiveCart],
  );

  // تعيين كمية بند مباشرة.
  const setQuantity = useCallback(
    (productId: ID, quantity: number): CartActionResult => {
      try {
        setCart(applyQuantity(effectiveCart, productId, quantity));
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: reasonOf(error) };
      }
    },
    [effectiveCart],
  );

  // إزالة بند.
  const remove = useCallback(
    (productId: ID): CartActionResult => {
      try {
        setCart(removeLine(effectiveCart, productId));
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: reasonOf(error) };
      }
    },
    [effectiveCart],
  );

  // تعيين نسبة خصم إجمالي.
  const applyDiscountPercent = useCallback(
    (percent: number): CartActionResult => {
      try {
        setCart(applyDiscount(effectiveCart, percent));
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: reasonOf(error) };
      }
    },
    [effectiveCart],
  );

  // تصفير السلة (يُستدعى بعد إتمام البيع لاحقًا).
  const clear = useCallback(() => setCart(emptyCart(currency, storeId)), [currency, storeId]);

  // كمية منتج في السلة (للشارة على البطاقة).
  const findQuantity = useCallback(
    (productId: ID): number =>
      effectiveCart.lines.find((l) => String(l.productId) === String(productId))?.quantity ?? 0,
    [effectiveCart],
  );

  // تجميع قيم السياق.
  const value = useMemo<CartContextValue>(
    () => ({
      cart: effectiveCart,
      totals,
      currency,
      taxRatePercent,
      add,
      increment,
      decrement,
      setQuantity,
      remove,
      applyDiscountPercent,
      clear,
      findQuantity,
    }),
    [effectiveCart, totals, currency, taxRatePercent, add, increment, decrement, setQuantity, remove, applyDiscountPercent, clear, findQuantity],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// خطاف القراءة من السياق.
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within <CartProvider>');
  return ctx;
}
