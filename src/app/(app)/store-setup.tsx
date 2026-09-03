/**
 * بوابة إعداد المتجر (PHASE 09).
 * تعرض معالج الإعداد الكامل بدل اللافتة المؤقتة.
 * الوصول متاح بعد تسجيل الدخول وقبل إتمام الإعداد (حراسة المسارات).
 */
import { SetupWizard } from '@/features/setup/SetupWizard';

// الشاشة تعرض المعالج مباشرة (التنقل والحفظ بداخله).
export default function StoreSetupScreen() {
  return <SetupWizard />;
}
