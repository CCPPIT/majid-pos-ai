/**
 * مسار المشتريات (PHASE 18).
 * شاشة كاملة خارج التبويبات: أوامر الشراء + المورّدون.
 * الحماية بالصلاحية مدمجة داخل ProcurementScreen.
 */
import { ProcurementScreen } from '@/features/procurement/ProcurementScreen';

// نعرض شاشة المشتريات.
export default function ProcurementRoute() {
  return <ProcurementScreen />;
}
