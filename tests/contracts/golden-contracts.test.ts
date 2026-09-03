/**
 * اختبارات العقود الذهبية (Golden Contracts) — PHASE 32 · أقسام 56 · 57.
 *
 * لقطة ثابتة للعقود الحرجة (منتج · فاتورة · دفعة · مخزون · مخرجات ذكاء).
 * أي تغيير غير مقصود في شكل العقد أو نسخته يفشل الاختبار، فيُجبَر
 * الفريق على رفع النسخة وتوفير ترحيل عند التغيير الكاسر عمدًا.
 *
 * كما يختبر هذا الملف «اختبار المستهلك» (قسم 57): مستهلك قديم يستدعي
 * واجهة الـSDK الحالية ولا ينكسر بعد MINOR/PATCH.
 */
import {
  DOMAIN_CONTRACT_VERSIONS,
  SDK_VERSION,
  contractRegistry,
  registerAllContracts,
} from '@/contracts';
import { PRODUCT_CONTRACT_NAME, PRODUCT_CONTRACT_VERSION } from '@/contracts/products/product.contract';
import { SALE_CONTRACT_NAME, SALE_V2 } from '@/contracts/sales/sale.contract';
import { PAYMENT_CONTRACT_NAME, PAYMENT_CONTRACT_VERSION } from '@/contracts/payments/payment.contract';
import { INVENTORY_CONTRACT_VERSION, INVENTORY_CONTRACT_NAME } from '@/contracts/inventory/inventory.contract';
import { AI_CONTRACT_NAME, AI_CONTRACT_VERSION } from '@/contracts/ai/ai.contract';
import { createMajidSDK } from '@/sdk';
import { saleV2Fixture } from './fixtures';

// نسجّل العقود قبل الاختبار.
beforeAll(() => registerAllContracts());

// لقطة النسخ الحرجة (تُحدَّث عمدًا فقط عند إصدار جديد + ترحيل).
describe('PHASE 32 — Golden Contract Versions (§56)', () => {
  it('يثبّت إصدار الـSDK والنسخ الحرجة', () => {
    expect(SDK_VERSION).toBe('1.1.0');
    expect(DOMAIN_CONTRACT_VERSIONS.sales).toBe(SALE_V2);
    expect(PRODUCT_CONTRACT_VERSION).toBe('1.0.0');
    expect(PAYMENT_CONTRACT_VERSION).toBe('1.0.0');
    expect(INVENTORY_CONTRACT_VERSION).toBe('1.0.0');
    expect(AI_CONTRACT_VERSION).toBe('1.0.0');
  });

  it('كل عقد حرج مسجّل بالاسم والنسخة المتوقعة', () => {
    expect(contractRegistry.get(PRODUCT_CONTRACT_NAME)?.support.current).toBe(PRODUCT_CONTRACT_VERSION);
    expect(contractRegistry.get(SALE_CONTRACT_NAME)?.support.current).toBe(SALE_V2);
    expect(contractRegistry.get(PAYMENT_CONTRACT_NAME)?.support.current).toBe(PAYMENT_CONTRACT_VERSION);
    expect(contractRegistry.get(INVENTORY_CONTRACT_NAME)?.support.current).toBe(INVENTORY_CONTRACT_VERSION);
    expect(contractRegistry.get(AI_CONTRACT_NAME)?.stability).toBe('experimental');
  });

  it('الفاتورة الذهبية V2 ثابتة الشكل (snapshot)', () => {
    // لقطة كائن الفاتورة المرحَّلة — أي تغيير غير مقصود يُسقِط الاختبار.
    expect(saleV2Fixture).toMatchInlineSnapshot(`
{
  "customerName": "عميل نقدي",
  "id": "sale-0001",
  "saleNumber": "ORD-0001",
  "total": {
    "amount": 12500,
    "currency": "YER",
  },
}
`);
  });
});

// اختبار المستهلك: واجهة الـSDK العلنية تظل صالحة بعد MINOR/PATCH (§57).
describe('PHASE 32 — SDK Consumer Stability (§57)', () => {
  it('يكشف الـSDK واجهة contracts و capabilities مستقرة', async () => {
    // نستدعي العميل عبر المصنع الحقيقي بمستودعات وهمية بسيطة.
    const noop = async () => ({ success: true as const, data: undefined });
    const sdk = createMajidSDK({
      repositories: {
        products: { list: noop, getById: noop, search: noop } as never,
        sales: { list: noop, getById: noop } as never,
        payments: { list: noop } as never,
        inventory: { getStock: noop } as never,
        customers: { list: noop, getById: noop } as never,
        rbac: { getRoleByCode: async () => ({ permissions: [] }) } as never,
        tenancy: {} as never,
      },
    });

    // الواجهات الجديدة موجودة ومستقرة.
    expect(typeof sdk.contracts.version).toBe('function');
    expect(typeof sdk.capabilities.has).toBe('function');
    expect(sdk.contracts.version().sdkVersion).toBe(SDK_VERSION);
    // القدرات الأساسية متاحة.
    expect(sdk.capabilities.has('pos')).toBe(true);
    // الذكاء غير متاح دون مزوّد (لم يُحقن ai).
    expect(sdk.capabilities.has('ai')).toBe(false);
    sdk.dispose();
  });
});
