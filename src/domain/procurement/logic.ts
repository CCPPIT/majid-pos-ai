/**
 * منطق المشتريات النقي (PHASE 18).
 * بناء أوامر الشراء وحساب إجمالياتها النقدية، التحقق، وتعريف انتقالات الحالة
 * المسموحة. دوال خالصة بلا تخزين ولا واجهة — قابلة للاختبار بالكامل.
 */
import { asId, type ID } from '@/core/types/domain';
import {
  money,
  multiplyMoney,
  sumMoney,
  percentageOf,
  addMoney,
  roundMoney,
} from '@/core/money/money';
import { ValidationError } from '@/core/errors/AppError';
import type {
  CreatePurchaseOrderInput,
  DraftOrderLine,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderStatus,
  Supplier,
  SupplierDraft,
  TransitionResult,
} from './types';

// تنسيق رقم أمر الشراء: PO-0001.
export function formatPurchaseOrderNumber(sequence: number): string {
  return `PO-${String(sequence).padStart(4, '0')}`;
}

// ── تحقق المورّد ────────────────────────────────────────────────────────────

// تحقق نموذج مورّد (الاسم إلزامي، الهاتف/البريد صيغة إن وُجد).
export function validateSupplierDraft(draft: SupplierDraft): { valid: boolean; errorKey?: string } {
  if (!draft.nameAr.trim()) return { valid: false, errorKey: 'procurement.error.supplierNameRequired' };
  if (draft.phone.trim() && !/^[0-9+\s-]{6,20}$/.test(draft.phone.trim())) {
    return { valid: false, errorKey: 'procurement.error.phoneInvalid' };
  }
  if (draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
    return { valid: false, errorKey: 'procurement.error.emailInvalid' };
  }
  return { valid: true };
}

// يبني كيان مورّد من نموذج.
export function createSupplierFromDraft(
  draft: SupplierDraft,
  ctx: { tenantId: ID; organizationId?: ID; branchId?: ID; sequence: number },
  now: string = new Date().toISOString(),
): Supplier {
  const validation = validateSupplierDraft(draft);
  if (!validation.valid) throw new ValidationError(validation.errorKey ?? 'Invalid supplier');
  const id: ID = asId(`supplier-${ctx.sequence}-${Date.now()}`);
  return {
    id,
    tenantId: ctx.tenantId,
    organizationId: ctx.organizationId,
    branchId: ctx.branchId,
    nameAr: draft.nameAr.trim(),
    nameEn: draft.nameEn.trim() || draft.nameAr.trim(), // رجوع للعربي.
    contactName: draft.contactName.trim() || undefined,
    phone: draft.phone.trim() || undefined,
    email: draft.email.trim() || undefined,
    address: draft.address.trim() || undefined,
    taxNumber: draft.taxNumber.trim() || undefined,
    currency: draft.currency,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

// ── بناء سطر وأمر الشراء ────────────────────────────────────────────────────

// يبني سطر أمر شراء من سطر خام (مع حساب إجمالي السطر بالمال الحقيقي).
export function buildOrderLine(raw: DraftOrderLine, currency: string): PurchaseOrderLine {
  if (!Number.isFinite(raw.quantity) || raw.quantity <= 0) {
    throw new ValidationError('procurement.error.quantityInvalid');
  }
  if (!Number.isFinite(raw.unitCostAmount) || raw.unitCostAmount < 0) {
    throw new ValidationError('procurement.error.costInvalid');
  }
  const unitCost = money(roundMoney(raw.unitCostAmount), currency);
  return {
    productId: raw.productId,
    nameAr: raw.nameAr,
    nameEn: raw.nameEn,
    sku: raw.sku,
    barcode: raw.barcode,
    orderedQuantity: Math.trunc(raw.quantity),
    receivedQuantity: 0, // لم يُستلم شيء عند الإنشاء.
    unitCost,
    lineTotal: multiplyMoney(unitCost, Math.trunc(raw.quantity)),
  };
}

// يحسب إجماليات أمر الشراء من أسطر خام (subtotal/tax/total).
export function calculateTotals(lines: DraftOrderLine[], currency: string, taxRate: number) {
  if (!lines.length) throw new ValidationError('procurement.error.noLines');
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    throw new ValidationError('procurement.error.taxInvalid');
  }
  const lineTotals = lines.map((l) => {
    if (!Number.isFinite(l.quantity) || l.quantity <= 0) {
      throw new ValidationError('procurement.error.quantityInvalid');
    }
    if (!Number.isFinite(l.unitCostAmount) || l.unitCostAmount < 0) {
      throw new ValidationError('procurement.error.costInvalid');
    }
    return money(roundMoney(l.unitCostAmount * l.quantity), currency);
  });
  const subtotal = sumMoney(lineTotals, currency); // المجموع قبل الضريبة.
  const tax = percentageOf(subtotal, taxRate); // ضريبة المشتريات.
  const total = addMoney(subtotal, tax); // الإجمالي النهائي.
  return { subtotal, tax, total };
}

// يبني أمر شراء كاملًا في حالة مسودة.
export function createPurchaseOrder(input: CreatePurchaseOrderInput, now: string = new Date().toISOString()): PurchaseOrder {
  const { subtotal, tax, total } = calculateTotals(input.lines, input.currency, input.taxRate);
  const lines: PurchaseOrderLine[] = input.lines.map((l) => {
    const unitCost = money(roundMoney(l.unitCostAmount), input.currency);
    return {
      productId: l.productId,
      nameAr: l.nameAr,
      nameEn: l.nameEn,
      sku: l.sku,
      barcode: l.barcode,
      orderedQuantity: Math.trunc(l.quantity),
      receivedQuantity: 0,
      unitCost,
      lineTotal: multiplyMoney(unitCost, Math.trunc(l.quantity)),
    };
  });

  const id: ID = asId(`po-${input.sequence}-${Date.now()}`);
  return {
    id,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    branchId: input.branchId,
    storeId: input.storeId,
    poNumber: formatPurchaseOrderNumber(input.sequence),
    supplierId: input.supplierId,
    supplierNameAr: input.supplierNameAr,
    supplierNameEn: input.supplierNameEn,
    status: 'draft',
    lines,
    currency: input.currency,
    subtotal,
    taxRate: input.taxRate,
    tax,
    total,
    notes: input.notes?.trim() || undefined,
    expectedDate: input.expectedDate,
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
  };
}

// ── انتقالات الحالة ─────────────────────────────────────────────────────────

// الانتقالات المسموحة في دورة حياة أمر الشراء.
const ALLOWED_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  draft: ['submitted', 'cancelled'], // مسودة: تُقدَّم أو تُلغى.
  submitted: ['approved', 'cancelled', 'draft'], // مقدَّمة: تُعتمد أو تُلغى أو تُعاد.
  approved: ['partially_received', 'received', 'cancelled'], // معتمدة: تُستلَم.
  partially_received: ['received', 'cancelled'], // مستلَمة جزئيًا: تكتمل أو تُلغى.
  received: [], // مكتملة: لا انتقال.
  cancelled: [], // ملغاة: لا انتقال.
};

// يفحص هل انتقال الحالة مسموح.
export function canTransition(from: PurchaseOrderStatus, to: PurchaseOrderStatus): TransitionResult {
  if (from === to) return { allowed: false, reason: 'procurement.error.sameStatus' };
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
    return { allowed: false, reason: 'procurement.error.invalidTransition' };
  }
  return { allowed: true };
}

// يطبّق انتقال الحالة مع الطوابع الزمنية (يفشل إن كان غير مسموح).
export function transitionPurchaseOrder(
  po: PurchaseOrder,
  to: PurchaseOrderStatus,
  ctx: { userId?: ID; now?: string } = {},
): PurchaseOrder {
  const check = canTransition(po.status, to);
  if (!check.allowed) throw new ValidationError(check.reason ?? 'procurement.error.invalidTransition');
  const now = ctx.now ?? new Date().toISOString();
  const next: PurchaseOrder = { ...po, status: to, updatedAt: now };

  // الطوابع الزمنية ومعتمد الأمر حسب الحالة الهدف.
  if (to === 'submitted') next.submittedAt = now;
  if (to === 'approved') {
    next.approvedAt = now;
    next.approvedBy = ctx.userId;
  }
  if (to === 'received') next.receivedAt = now;
  if (to === 'cancelled') next.cancelledAt = now;
  return next;
}

// هل أمر الشراء قابل للاستلام (معتمد أو مستلَم جزئيًا)؟
export function isReceivable(po: PurchaseOrder): boolean {
  return po.status === 'approved' || po.status === 'partially_received';
}

// هل اكتمل استلام كل الكميات؟
export function isFullyReceived(po: PurchaseOrder): boolean {
  return po.lines.every((line) => line.receivedQuantity >= line.orderedQuantity);
}

// يسجّل استلام كمية لمنتج في أمر معتمد ويعيد الأمر المحدّث (دون تخزين).
// الكمية تُضاف لما استُلم بالفعل، وتُقيَّد ألا تتجاوز المطلوب.
export function recordReceipt(po: PurchaseOrder, productId: ID, quantity: number, now: string = new Date().toISOString()): PurchaseOrder {
  if (!isReceivable(po)) throw new ValidationError('procurement.error.notReceivable');
  if (!Number.isFinite(quantity) || quantity <= 0) throw new ValidationError('procurement.error.quantityInvalid');

  const lines = po.lines.map((line) => {
    if (String(line.productId) !== String(productId)) return line;
    const received = Math.min(line.orderedQuantity, line.receivedQuantity + Math.trunc(quantity));
    return { ...line, receivedQuantity: received };
  });

  const next: PurchaseOrder = { ...po, lines, updatedAt: now };
  // الحالة تتحول لمستلَم جزئيًا أو مكتمل حسب الاكتمال.
  next.status = isFullyReceived(next) ? 'received' : 'partially_received';
  if (next.status === 'received') next.receivedAt = now;
  return next;
}

// مجموع الكميات المطلوبة (للعرض).
export function totalOrderedQuantity(po: PurchaseOrder): number {
  return po.lines.reduce((sum, line) => sum + line.orderedQuantity, 0);
}

// مجموع الكميات المُستلَمة (للعرض).
export function totalReceivedQuantity(po: PurchaseOrder): number {
  return po.lines.reduce((sum, line) => sum + line.receivedQuantity, 0);
}
