/**
 * مسار المالية والمحاسبة (PHASE 20).
 * شاشة كاملة خارج التبويبات: تقرير مالي مشتق + إضافة مصروف.
 * الحماية بالصلاحية مدمجة داخل FinanceScreen.
 */
import { FinanceScreen } from '@/features/finance/FinanceScreen';

// نعرض شاشة المالية.
export default function FinanceRoute() {
  return <FinanceScreen />;
}
