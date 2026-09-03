/**
 * مُصنِّع كيان العميل والتحقق منه (PHASE 19).
 * يبني عميلًا جديدًا بقيم ولاء ابتدائية، ويتحقق من نموذج الإدخال.
 * دوال خالصة — المال عبر core/money فقط.
 */
import { money } from '@/core/money/money';
import { ValidationError } from '@/core/errors/AppError';
import { asId, type ID } from '@/core/types/domain';
import { tierForSpent } from './loyalty';
import type { ContactChannel, Customer, CustomerDraft, CustomerKind } from './types';

// طول الاسم الأقصى.
export const NAME_MAX = 80;

// تطبيع الهاتف (أرقام + فقط).
export function normalizePhone(phone: string): string {
  return phone.trim().replace(/[\s-]/g, '');
}

// تحقق نموذج عميل (الاسم إلزامي، الهاتف/البريد صيغة إن وُجدا).
export function validateCustomerDraft(draft: CustomerDraft): { valid: boolean; errorKey?: string } {
  if (!draft.fullName.trim()) return { valid: false, errorKey: 'customers.error.nameRequired' };
  if (draft.fullName.trim().length > NAME_MAX) return { valid: false, errorKey: 'customers.error.nameTooLong' };
  if (draft.phone.trim() && !/^[0-9+]{6,20}$/.test(normalizePhone(draft.phone))) {
    return { valid: false, errorKey: 'customers.error.phoneInvalid' };
  }
  if (draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
    return { valid: false, errorKey: 'customers.error.emailInvalid' };
  }
  return { valid: true };
}

// يحوّل نص الوسوم إلى قائمة (مفصولة بفواصل).
export function parseTags(tagsText: string): string[] {
  return tagsText
    .split(/[,،]/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .slice(0, 10);
}

// يبني عميلًا جديدًا من النموذج (رصيد ولاء صفر، شريحة برونزي).
export function createCustomerFromDraft(
  draft: CustomerDraft,
  ctx: { tenantId: ID; organizationId?: ID; branchId?: ID; storeId?: ID; currency: string },
  now: string = new Date().toISOString(),
): Customer {
  const validation = validateCustomerDraft(draft);
  if (!validation.valid) throw new ValidationError(validation.errorKey ?? 'Invalid customer');

  const kind: CustomerKind = draft.kind;
  const channel: ContactChannel = draft.preferredChannel;

  return {
    id: asId(`customer-${Date.now()}`),
    tenantId: ctx.tenantId,
    organizationId: ctx.organizationId,
    branchId: ctx.branchId,
    storeId: ctx.storeId,
    kind,
    fullName: draft.fullName.trim(),
    phone: draft.phone.trim() ? normalizePhone(draft.phone) : undefined,
    email: draft.email.trim() || undefined,
    address: draft.address.trim() || undefined,
    totalSpent: money(0, ctx.currency),
    orderCount: 0,
    pointsBalance: 0,
    totalPointsEarned: 0,
    tier: tierForSpent(0),
    preferredChannel: channel,
    tags: parseTags(draft.tags),
    notes: [],
    purchases: [],
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

// يحدّث الحقول التعريفية لعميل قائم من نموذج (يحافظ على الولاء والسجل).
export function applyDraftToCustomer(
  existing: Customer,
  draft: CustomerDraft,
  now: string = new Date().toISOString(),
): Customer {
  const validation = validateCustomerDraft(draft);
  if (!validation.valid) throw new ValidationError(validation.errorKey ?? 'Invalid customer');
  return {
    ...existing,
    kind: draft.kind,
    fullName: draft.fullName.trim(),
    phone: draft.phone.trim() ? normalizePhone(draft.phone) : undefined,
    email: draft.email.trim() || undefined,
    address: draft.address.trim() || undefined,
    preferredChannel: draft.preferredChannel,
    tags: parseTags(draft.tags),
    updatedAt: now,
  };
}

// يحوّل عميلًا قائمًا إلى نموذج إدخال (لفتح التعديل).
export function customerToDraft(customer: Customer): CustomerDraft {
  return {
    kind: customer.kind,
    fullName: customer.fullName,
    phone: customer.phone ?? '',
    email: customer.email ?? '',
    address: customer.address ?? '',
    preferredChannel: customer.preferredChannel,
    tags: customer.tags.join(', '),
  };
}
