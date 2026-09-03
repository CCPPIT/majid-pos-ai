/**
 * مسار العملاء (PHASE 19).
 * شاشة كاملة خارج التبويبات: قائمة عملاء CRM + إضافة عميل.
 * الحماية بالصلاحية مدمجة داخل CustomersScreen.
 */
import { CustomersScreen } from '@/features/customers/CustomersScreen';

// نعرض شاشة العملاء.
export default function CustomersRoute() {
  return <CustomersScreen />;
}
