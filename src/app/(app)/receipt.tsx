/**
 * مسار الإيصال (PHASE 15 — Receipts).
 * يستقبل معرف الطلب (orderId) ويعرض إيصال البيع مع المشاركة.
 */
import { ReceiptScreen } from '@/features/receipt/ReceiptScreen';

// نعرض شاشة الإيصال (تقرأ orderId من المعاملات).
export default function ReceiptRoute() {
  return <ReceiptScreen />;
}
