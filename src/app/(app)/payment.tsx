/**
 * مسار الدفع (PHASE 14 — Payments).
 * يستقبل معرف الطلب كمعامل (orderId) ويعرض شاشة التحصيل.
 */
import { PaymentScreen } from '@/features/payment/PaymentScreen';

// نعرض شاشة الدفع (تقرأ orderId من المعاملات).
export default function PaymentRoute() {
  return <PaymentScreen />;
}
