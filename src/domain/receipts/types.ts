/**
 * أنواع الإيصال (PHASE 15 — Receipts).
 * الإيصال لقطة نصية منظمة تُبنى من طلب البيع (+ الدفعة) وتُستخدم للعرض
 * والمشاركة/الطباعة. المبالغ تُمرر منسّقة نصًا لتبقى الطبقة مستقلة عن الواجهة.
 */

// بيانات ترويسة الإيصال (المتجر/الفرع/السلسلة).
export interface ReceiptHeader {
  businessName: string; // اسم العمل/السلسلة.
  branchName?: string; // الفرع.
  storeName: string; // المتجر.
  addressLine?: string; // سطر العنوان (اختياري).
  phoneLine?: string; // سطر الهاتف (اختياري).
}

// سطر صنف في الإيصال (قيم نصية جاهزة للعرض).
export interface ReceiptLine {
  name: string; // اسم الصنف (حسب اللغة).
  quantity: number; // الكمية.
  unitPriceText: string; // سعر الوحدة منسّق.
  lineTotalText: string; // إجمالي السطر منسّق.
}

// صف إجمالي في الإيصال.
export interface ReceiptTotalRow {
  label: string; // التسمية (مترجمة).
  value: string; // القيمة منسّقة.
  emphasis?: boolean; // إبراز (الإجمالي النهائي).
}

// معلومات الدفع في الإيصال.
export interface ReceiptPayment {
  methodLabel: string; // طريقة الدفع (مترجمة).
  totalText: string; // الإجمالي المدفوع.
  tenderedText?: string; // المُسلَّم (نقدي).
  changeText?: string; // الباقي (نقدي).
  reference?: string; // رقم العملية.
}

// كيان الإيصال الكامل.
export interface Receipt {
  header: ReceiptHeader; // الترويسة.
  orderNumber: string; // رقم الطلب.
  createdAt: string; // لحظة الإنشاء (ISO).
  dateText: string; // التاريخ/الوقت منسّقًا.
  customerName: string; // اسم العميل.
  cashierName: string; // الكاشير.
  lines: ReceiptLine[]; // الأصناف.
  totals: ReceiptTotalRow[]; // صفوف الإجماليات.
  payment?: ReceiptPayment; // الدفع (إن وُجد).
  footerText: string; // سطر التذييل (شكرًا).
  isPaid: boolean; // هل دُفع الطلب؟
}
