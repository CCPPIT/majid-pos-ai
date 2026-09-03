/**
 * مستودع العملاء (PHASE 19).
 * يخفي المصدر عن الواجهة، يطبّق البحث/الفلترة النقية، ويدير دورة حياة العميل:
 * إنشاء/تعديل، إضافة ملاحظة CRM، وتسجيل عملية شراء تحدّث الولاء (نقاط/شريحة).
 * كل الحسابات في المجال؛ المستودع ينسّق فقط.
 */
import type { ID } from '@/core/types/domain';
import { ValidationError } from '@/core/errors/AppError';
import { logger } from '@/core/logging/logger';
import { money } from '@/core/money/money';
import {
  applyDraftToCustomer,
  createCustomerFromDraft,
  customerToDraft,
  newNoteId,
  recordPurchase,
  validateCustomerDraft,
  type Customer,
  type CustomerContext,
  type CustomerDraft,
  type CustomerQuery,
} from '@/domain/customers';
import type { CustomersSource } from '../sources/customers.source';

// واجهة المستودع.
export interface CustomersRepository {
  list(query?: CustomerQuery): Promise<Customer[]>;
  getById(id: ID): Promise<Customer | null>;
  findByPhone(phone: string): Promise<Customer | null>;
  create(draft: CustomerDraft, ctx: CustomerContext & { currency: string }): Promise<Customer>;
  update(customer: Customer, draft: CustomerDraft): Promise<Customer>;
  addNote(id: ID, text: string, ctx: CustomerContext): Promise<Customer>;
  // يسجّل عملية شراء مدفوعة ويحدّث الولاء (يُستدعى بعد الدفع الناجح).
  recordPurchaseFor(
    customerId: ID,
    purchase: { orderId: ID; orderNumber: string; totalAmount: number; currency: string; at: string },
  ): Promise<Customer | null>;
}

// فلترة نقية بقائمة عملاء.
function filterCustomers(customers: Customer[], query: CustomerQuery): Customer[] {
  let result = customers;
  const search = query.search?.trim().toLowerCase();
  if (search) {
    result = result.filter(
      (c) => c.fullName.toLowerCase().includes(search) || (c.phone ?? '').includes(search),
    );
  }
  if (query.tier) result = result.filter((c) => c.tier === query.tier);
  if (query.tag) result = result.filter((c) => c.tags.some((tag) => tag.toLowerCase() === query.tag!.toLowerCase()));
  if (query.limit) result = result.slice(0, query.limit);
  return result;
}

export class AppCustomersRepository implements CustomersRepository {
  constructor(private readonly source: CustomersSource) {} // نستقبل المصدر.

  async list(query: CustomerQuery = {}): Promise<Customer[]> {
    const all = await this.source.list();
    return filterCustomers(all, query);
  }

  async getById(id: ID): Promise<Customer | null> {
    const all = await this.source.list();
    return all.find((c) => String(c.id) === String(id)) ?? null;
  }

  async findByPhone(phone: string): Promise<Customer | null> {
    const all = await this.source.list();
    const normalized = phone.trim().replace(/[\s-]/g, '');
    return all.find((c) => (c.phone ?? '').replace(/[\s-]/g, '') === normalized) ?? null;
  }

  async create(draft: CustomerDraft, ctx: CustomerContext & { currency: string }): Promise<Customer> {
    const validation = validateCustomerDraft(draft);
    if (!validation.valid) {
      throw new ValidationError(validation.errorKey ?? 'Invalid customer');
    }
    // منع تكرار الهاتف (معرّف عملي في نقطة البيع).
    if (draft.phone.trim() && (await this.findByPhone(draft.phone))) {
      throw new ValidationError('customers.error.phoneDuplicate');
    }
    const customer = createCustomerFromDraft(draft, {
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
      branchId: ctx.branchId,
      storeId: ctx.storeId,
      currency: ctx.currency,
    });
    await this.source.save(customer);
    logger.info('Customer created', { id: String(customer.id) });
    return customer;
  }

  async update(customer: Customer, draft: CustomerDraft): Promise<Customer> {
    const validation = validateCustomerDraft(draft);
    if (!validation.valid) {
      throw new ValidationError(validation.errorKey ?? 'Invalid customer');
    }
    const updated = applyDraftToCustomer(customer, draft);
    await this.source.save(updated);
    logger.info('Customer updated', { id: String(customer.id) });
    return updated;
  }

  async addNote(id: ID, text: string, ctx: CustomerContext): Promise<Customer> {
    const customer = await this.getById(id);
    if (!customer) throw new ValidationError('customers.error.notFound');
    if (!text.trim()) throw new ValidationError('customers.error.noteRequired');
    const note = { id: newNoteId(), text: text.trim(), createdAt: new Date().toISOString(), createdBy: ctx.userId };
    const updated: Customer = {
      ...customer,
      notes: [note, ...customer.notes].slice(0, 100),
      updatedAt: new Date().toISOString(),
    };
    await this.source.save(updated);
    return updated;
  }

  async recordPurchaseFor(
    customerId: ID,
    purchase: { orderId: ID; orderNumber: string; totalAmount: number; currency: string; at: string },
  ): Promise<Customer | null> {
    const customer = await this.getById(customerId);
    if (!customer) {
      logger.warn('recordPurchaseFor unknown customer', { id: String(customerId) });
      return null; // عميل غير موجود (زائر) — لا شيء يُسجَّل.
    }
    const updated = recordPurchase({
      customer,
      orderId: purchase.orderId,
      orderNumber: purchase.orderNumber,
      total: money(purchase.totalAmount, purchase.currency),
      at: purchase.at,
    });
    await this.source.save(updated);
    logger.info('Customer purchase recorded', { id: String(customerId), order: purchase.orderNumber });
    return updated;
  }
}

// يُصدَّر لاستخدام الشاشات (تحويل عميل لنموذج).
export { customerToDraft };
