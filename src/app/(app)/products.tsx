/**
 * مسار إدارة المنتجات (PHASE 16).
 * شاشة كاملة خارج التبويبات: عرض/إضافة/تعديل/حذف أصناف الكتالوج.
 * الحماية بالصلاحية مدمجة داخل ProductsScreen (PermissionGuard).
 */
import { ProductsScreen } from '@/features/products/ProductsScreen';

// نعرض شاشة إدارة المنتجات.
export default function ProductsRoute() {
  return <ProductsScreen />;
}
