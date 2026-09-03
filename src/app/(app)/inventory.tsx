/**
 * مسار المخزون (PHASE 17).
 * شاشة كاملة خارج التبويبات: مستويات المخزون + سجل الحركات +
 * استلام/تسوية/تحويل. الحماية بالصلاحية مدمجة داخل InventoryScreen.
 */
import { InventoryScreen } from '@/features/inventory/InventoryScreen';

// نعرض شاشة المخزون.
export default function InventoryRoute() {
  return <InventoryScreen />;
}
