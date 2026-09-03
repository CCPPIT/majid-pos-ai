/**
 * اختبارات مجال ومستودع العملاء وCRM والولاء (PHASE 19).
 * تغطي: تحقق العميل، حساب النقاط، اشتقاق الشريحة، تسجيل الشراء
 * (زيادة الإنفاق/النقاط/الترقية ومنع التكرار)، والمستودع:
 * إنشاء/بحث/تعديل/ملاحظة/تسجيل شراء يحدّث الولاء.
 */
import {
  pointsForAmount,
  tierForSpent,
  isTierUpgrade,
  recordPurchase,
  loyaltySummary,
  validateCustomerDraft,
  createCustomerFromDraft,
  applyDraftToCustomer,
  parseTags,
  type CustomerDraft,
} from '@/domain/customers';
import { ValidationError } from '@/core/errors/AppError';
import { money } from '@/core/money/money';
import { asId } from '@/core/types/domain';
import { LocalCustomersSource } from '@/data/sources/customers.source';
import { AppCustomersRepository } from '@/data/repositories/customers.repository';
import { InMemoryPreferencesSource } from '@/data/sources/preferences.source';

// سياق للاختبارات.
const ctx = { tenantId: asId('tenant-t'), storeId: asId('store-1'), currency: 'YER' };

// نموذج عميل صالح.
const validDraft: CustomerDraft = {
  kind: 'individual',
  fullName: 'محمد العميل',
  phone: '777123456',
  email: 'c@example.com',
  address: 'صنعاء',
  preferredChannel: 'whatsapp',
  tags: 'VIP, جملة',
};

describe('customer validation & factory (PHASE 19)', () => {
  test('accepts valid draft', () => {
    expect(validateCustomerDraft(validDraft).valid).toBe(true);
  });

  test('rejects missing name, bad phone and email', () => {
    expect(validateCustomerDraft({ ...validDraft, fullName: '' }).valid).toBe(false);
    expect(validateCustomerDraft({ ...validDraft, phone: 'xyz' }).errorKey).toBe('customers.error.phoneInvalid');
    expect(validateCustomerDraft({ ...validDraft, email: 'bad' }).errorKey).toBe('customers.error.emailInvalid');
  });

  test('parses comma-separated tags (Arabic and English commas)', () => {
    expect(parseTags('VIP, جملة، خاص')).toEqual(['VIP', 'جملة', 'خاص']);
  });

  test('creates a customer with zero loyalty and bronze tier', () => {
    const c = createCustomerFromDraft(validDraft, ctx);
    expect(c.totalSpent).toEqual(money(0, 'YER'));
    expect(c.orderCount).toBe(0);
    expect(c.pointsBalance).toBe(0);
    expect(c.tier).toBe('bronze');
    expect(c.tags).toContain('VIP');
  });

  test('update preserves loyalty and changes profile fields', () => {
    const c = createCustomerFromDraft(validDraft, ctx);
    const updated = applyDraftToCustomer(c, { ...validDraft, fullName: 'محمد علي', phone: '777000000' });
    expect(updated.fullName).toBe('محمد علي');
    expect(updated.pointsBalance).toBe(0); // الولاء محفوظ.
    expect(updated.phone).toBe('777000000');
  });
});

describe('loyalty logic (PHASE 19)', () => {
  test('points: 1 point per 1000 currency (no fractional points)', () => {
    expect(pointsForAmount(1500)).toBe(1);
    expect(pointsForAmount(2500)).toBe(2);
    expect(pointsForAmount(0)).toBe(0);
  });

  test('tier derives from cumulative spend', () => {
    expect(tierForSpent(0)).toBe('bronze');
    expect(tierForSpent(60_000)).toBe('silver');
    expect(tierForSpent(300_000)).toBe('gold');
    expect(tierForSpent(1_500_000)).toBe('platinum');
  });

  test('upgrade ordering', () => {
    expect(isTierUpgrade('bronze', 'silver')).toBe(true);
    expect(isTierUpgrade('gold', 'bronze')).toBe(false);
  });

  test('recordPurchase accumulates spend, orders, points and tier, and prevents duplicates', () => {
    let c = createCustomerFromDraft(validDraft, ctx);
    c = recordPurchase({
      customer: c,
      orderId: asId('o1'),
      orderNumber: 'ORD-0001',
      total: money(60_000, 'YER'),
      at: '2026-01-01T10:00:00.000Z',
    });
    expect(c.orderCount).toBe(1);
    expect(c.totalSpent).toEqual(money(60_000, 'YER'));
    expect(c.pointsBalance).toBe(60);
    expect(c.tier).toBe('silver');
    expect(c.lastVisitAt).toBe('2026-01-01T10:00:00.000Z');

    // تكرار نفس الطلب لا يضيف شيئًا.
    const before = c.orderCount;
    c = recordPurchase({
      customer: c,
      orderId: asId('o1'),
      orderNumber: 'ORD-0001',
      total: money(60_000, 'YER'),
      at: '2026-01-01T10:00:00.000Z',
    });
    expect(c.orderCount).toBe(before);

    // شراء ثانٍ كبير يرقّي للذهبي.
    c = recordPurchase({
      customer: c,
      orderId: asId('o2'),
      orderNumber: 'ORD-0002',
      total: money(200_000, 'YER'),
      at: '2026-02-01T10:00:00.000Z',
    });
    expect(c.orderCount).toBe(2);
    expect(c.tier).toBe('gold');
    expect(c.totalSpent).toEqual(money(260_000, 'YER'));

    const summary = loyaltySummary(c);
    expect(summary.nextTier).toBe('platinum');
    expect(summary.toNextTier).toBe(1_000_000 - 260_000);
  });
});

// يبني مستودع عملاء فوق تخزين ذاكرة.
function makeRepo() {
  const prefs = new InMemoryPreferencesSource();
  const source = new LocalCustomersSource({
    getString: (k) => prefs.getString(k),
    setString: (k, v) => prefs.setString(k, v),
  });
  return new AppCustomersRepository(source);
}

describe('customers repository (PHASE 19)', () => {
  test('create, search and find by phone', async () => {
    const repo = makeRepo();
    const customer = await repo.create(validDraft, ctx);
    expect(customer.fullName).toBe('محمد العميل');

    const byName = await repo.list({ search: 'محمد' });
    expect(byName.some((c) => c.id === customer.id)).toBe(true);

    const byPhone = await repo.findByPhone('777123456');
    expect(byPhone?.id).toEqual(customer.id);
  });

  test('duplicate phone rejected', async () => {
    const repo = makeRepo();
    await repo.create(validDraft, ctx);
    await expect(repo.create({ ...validDraft, fullName: 'آخر' }, ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('addNote attaches a CRM note', async () => {
    const repo = makeRepo();
    const customer = await repo.create(validDraft, ctx);
    const updated = await repo.addNote(customer.id, 'عميل جملة دائم', { tenantId: ctx.tenantId });
    expect(updated.notes.length).toBe(1);
    expect(updated.notes[0]?.text).toBe('عميل جملة دائم');
  });

  test('recordPurchaseFor updates loyalty and ignores unknown customer', async () => {
    const repo = makeRepo();
    const customer = await repo.create(validDraft, ctx);

    const updated = await repo.recordPurchaseFor(customer.id, {
      orderId: asId('o1'),
      orderNumber: 'ORD-0001',
      totalAmount: 100_000,
      currency: 'YER',
      at: '2026-03-01T10:00:00.000Z',
    });
    expect(updated?.orderCount).toBe(1);
    expect(updated?.pointsBalance).toBe(100);
    expect(updated?.tier).toBe('silver');

    // عميل غير موجود → null دون خطأ.
    const missing = await repo.recordPurchaseFor(asId('nope'), {
      orderId: asId('o2'),
      orderNumber: 'ORD-0002',
      totalAmount: 10,
      currency: 'YER',
      at: '2026-03-02T10:00:00.000Z',
    });
    expect(missing).toBeNull();
  });
});
