/**
 * تبويب الطلبات (PHASE 13 — Checkout).
 * يعرض طلبات البيع المخزنة محليًا (الأحدث أولًا) بنطاق المتجر النشط.
 * الدفع الفعلي لكل طلب يأتي في PHASE 14 (لافتة صادقة داخل الشاشة).
 */
import { OrdersScreen } from '@/features/orders/OrdersScreen';

// نعرض شاشة الطلبات مباشرة.
export default function OrdersTab() {
  return <OrdersScreen />;
}
