/**
 * مسار تفاصيل أمر الشراء (PHASE 18).
 * يستقبل معرف الأمر كمعامل مسار (id) ويعرض شاشة التفاصيل.
 */
import { PurchaseOrderDetailScreen } from '@/features/procurement/PurchaseOrderDetailScreen';

// نعرض شاشة تفاصيل أمر الشراء.
export default function PurchaseOrderDetailRoute() {
  return <PurchaseOrderDetailScreen />;
}
