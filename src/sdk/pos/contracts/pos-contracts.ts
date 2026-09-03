/**
 * عقود نقطة البيع — PHASE 31 · أقسام 16 و17.
 * نقطة البيع طبقة تنسيق (Orchestration) لا تملك بيانات خاصة: تجمع
 * السلة والفاتورة والدفع والمخزون في عملية واحدة متماسكة.
 */
import type { CurrencyCode, ISODateTime, Money, StoreId, UserId } from '@/sdk/core';
import type { Cart, CartTotals } from '@/sdk/cart';
import type { Payment, PaymentMethod } from '@/sdk/payments';
import type { Receipt, Sale } from '@/sdk/sales';

// حالة جلسة نقطة البيع.
export type PosSessionStatus = 'open' | 'suspended' | 'closed';

// جلسة نقطة بيع (وردية كاشير).
export interface PosSession {
  readonly id: string; // معرّف الجلسة.
  readonly storeId: StoreId; // المتجر.
  readonly cashierId?: UserId; // الكاشير.
  readonly cashierName: string; // اسمه.
  readonly status: PosSessionStatus; // حالتها.
  readonly openingFloat: Money; // النقد الافتتاحي في الدرج.
  readonly openedAt: ISODateTime; // لحظة الفتح.
  readonly closedAt?: ISODateTime; // لحظة الإغلاق.
  readonly salesCount: number; // عدد الفواتير في الوردية.
  readonly salesTotal: Money; // إجمالي مبيعاتها.
}

// نتيجة عملية بيع كاملة (فاتورة + دفعة + إيصال).
export interface CheckoutResult {
  readonly sale: Sale; // الفاتورة المُنشأة.
  readonly payment: Payment; // الدفعة المُحصَّلة.
  readonly receipt: Receipt; // الإيصال الجاهز.
  readonly change: Money; // الباقي للعميل.
}

// أمر إتمام بيع كامل من السلة الحالية.
export interface CheckoutCommand {
  readonly method: PaymentMethod; // طريقة الدفع.
  readonly tendered?: number; // المُسلَّم (نقدًا).
  readonly splits?: readonly { method: PaymentMethod; amount: number; reference?: string }[]; // الدفع المقسّم.
  readonly customerId?: string; // العميل المسجّل.
  readonly customerName?: string; // اسم العميل.
  readonly cashierName?: string; // اسم الكاشير.
  readonly reference?: string; // مرجع خارجي.
}

// لقطة حالة نقطة البيع (تستهلكها الواجهة مباشرة).
export interface PosSnapshot {
  readonly cart: Cart; // السلة الحالية.
  readonly totals: CartTotals; // إجمالياتها المحسوبة.
  readonly currency: CurrencyCode; // العملة النشطة.
  readonly canCheckout: boolean; // هل يمكن إتمام البيع الآن؟
  readonly availableMethods: readonly PaymentMethod[]; // طرق الدفع المتاحة.
}
