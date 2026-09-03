/**
 * تبويب نقطة البيع (PHASE 11 — POS Core).
 * يعرض شاشة نقطة البيع الحقيقية: بحث/مسح المنتجات من الكتالوج.
 * السلة والدفع يأتيان في PHASE 12-15 (لافتات صادقة داخل الشاشة).
 */
import { PosScreen } from '@/features/pos/PosScreen';
import { productsRepository } from '@/shared/container';

// الشاشة تستخدم مستودع المنتجات المحقون من حاوية التركيب.
export default function PosTab() {
  return <PosScreen repository={productsRepository} />;
}
