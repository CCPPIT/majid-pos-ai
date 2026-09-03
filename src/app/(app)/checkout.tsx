/**
 * مسار إتمام البيع (PHASE 13 — Checkout).
 * شاشة كاملة خارج التبويبات السفلية: مراجعة السلة وإنشاء طلب البيع.
 */
import { CheckoutScreen } from '@/features/checkout/CheckoutScreen';

// نعرض شاشة الدفع مباشرة.
export default function CheckoutRoute() {
  return <CheckoutScreen />;
}
