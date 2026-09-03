/**
 * مسار ملف العميل (PHASE 19).
 * يستقبل معرف العميل (id) ويعرض شاشة التفاصيل (ولاء/مشتريات/ملاحظات).
 */
import { CustomerDetailScreen } from '@/features/customers/CustomerDetailScreen';

// نعرض شاشة ملف العميل.
export default function CustomerDetailRoute() {
  return <CustomerDetailScreen />;
}
