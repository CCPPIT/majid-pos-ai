/**
 * مسار شاشة إعدادات الأمان (PHASE 26).
 * موجه خفيف يعرض شاشة الأمان (القفل التلقائي/البصمة/سلامة الجهاز).
 */
import { SecurityScreen } from '@/features/security/SecurityScreen';

export default function SecurityRoute() {
  return <SecurityScreen />;
}
