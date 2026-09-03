/**
 * أنواع سلة البيع (PHASE 12 — Cart Engine).
 * السلة مجموعة بنود (CartLine) + نسبة خصم. كل الأسعار كائنات Money حقيقية،
 * والحسابات تتم في cart.ts عبر core/money (لا floating خام في الواجهة).
 */
import type { ID, ISODateString } from '@/core/types/domain';
import type { CurrencyCode, Money } from '@/core/money/money';

// بند في السلة (لقطة من المنتج لحظة الإضافة).
export interface CartLine {
  productId: ID; // معرف المنتج.
  sku: string; // رمز الصنف (مرجع).
  nameAr: string; // اسم عربي (عرض).
  nameEn: string; // اسم إنجليزي (عرض).
  unitPrice: Money; // سعر الوحدة (قيمة نقدية).
  taxIncluded: boolean; // هل السعر شامل الضريبة؟
  quantity: number; // الكمية المختارة.
  maxStock: number; // أقصى كمية متوفرة (من المخزون).
}

// حالة السلة.
export interface Cart {
  id: string; // معرف السلة (للمزامنة/الإيصال لاحقًا).
  storeId?: ID; // المتجر النشط (تُصفّر السلة عند تغيّره).
  currency: CurrencyCode; // عملة السلة (كل البنود بنفس العملة).
  lines: CartLine[]; // البنود.
  discountPercent: number; // نسبة الخصم الإجمالي (0..100).
  createdAt: ISODateString; // لحظة الإنشاء.
  updatedAt: ISODateString; // آخر تحديث.
}

// إجماليات السلة المالية (كلها Money بنفس العملة).
export interface CartTotals {
  lineCount: number; // عدد البنود المختلفة.
  totalQuantity: number; // مجموع الكميات.
  subtotal: Money; // الإجمالي قبل الضريبة والخصم (مجموع القيم كما هي).
  discount: Money; // قيمة الخصم.
  netTotal: Money; // الصافي بعد الخصم (قبل إضافة ضريبة غير شاملة).
  taxAmount: Money; // مبلغ الضريبة.
  total: Money; // الإجمالي النهائي (المدفوع).
  isEmpty: boolean; // هل السلة فارغة؟
}

// سبب خطأ قاعدة السلة (تُرسم له رسالة محلية في الواجهة).
export type CartErrorReason =
  | 'EMPTY_CART' // عملية على سلة فارغة.
  | 'LINE_NOT_FOUND' // بند غير موجود.
  | 'EXCEEDS_STOCK' // كمية تتجاوز المخزون.
  | 'INVALID_QUANTITY' // كمية غير صالحة.
  | 'INVALID_DISCOUNT' // خصم خارج 0..100.
  | 'CURRENCY_MISMATCH'; // اختلاف عملة البند عن السلة.
