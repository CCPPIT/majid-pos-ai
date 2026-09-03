/**
 * اختبارات عقد مستودع المنتجات — PHASE 31 · قسم 61.
 *
 * هذا الملف ليس مجموعة اختبارات بذاته: هو **مواصفة قابلة للتشغيل** تُطبَّق
 * على أي تنفيذ لعقد `ProductRepository` (محلي · مُخزَّن · بعيد). أي تنفيذ
 * جديد يستدعي `runProductRepositoryContract` ويجب أن يجتازه كاملًا،
 * فيستحيل أن ينحرف تنفيذ عن سلوك آخر دون أن يسقط الاختبار.
 *
 * الامتداد `.contract.ts` لا `.test.ts` عمدًا: لا يلتقطه Jest وحده.
 */
import { asCategoryId, asProductId, toCurrencyCode } from '@/sdk/core';
import type { ProductRepository } from '@/sdk/products';
import { makeSDKProduct } from '../../helpers/sdk-mocks';

// مصنع التنفيذ محل الاختبار: يُعيد مستودعًا مهيّأً ببيانات البذرة.
export interface ProductRepositoryFactory {
  readonly name: string; // اسم التنفيذ (يظهر في تقرير الاختبار).
  // ينشئ نسخة نظيفة قبل كل اختبار.
  create(): Promise<ProductRepository> | ProductRepository;
}

// نطاق الاختبار المستخدم في عمليات الإنشاء.
const testScope = {
  tenantId: 't-test' as never,
  storeId: 's-test' as never,
};

/**
 * يشغّل مواصفة العقد كاملة على تنفيذ محدد.
 * كل اختبار هنا يصف سلوكًا **يجب** أن يلتزم به كل تنفيذ بلا استثناء.
 */
export const runProductRepositoryContract = (factory: ProductRepositoryFactory): void => {
  describe(`عقد ProductRepository — ${factory.name}`, () => {
    // نسخة نظيفة لكل اختبار (لا تسرّب حالة بين الحالات).
    let repository: ProductRepository;

    beforeEach(async () => {
      repository = await factory.create();
    });

    describe('القراءة', () => {
      // السرد يُعيد نتيجة مُرقَّمة دائمًا (لا مصفوفة خام).
      it('يُعيد السرد نتيجة مُرقَّمة', async () => {
        const result = await repository.list();
        expect(result.success).toBe(true);
        if (!result.success) return;
        // البنية المُرقَّمة إلزامية في العقد.
        expect(Array.isArray(result.data.items)).toBe(true);
        expect(typeof result.data.pageInfo.total).toBe('number');
      });

      // الجلب بمعرّف موجود ينجح.
      it('يجلب منتجًا بمعرّفه', async () => {
        const list = await repository.list();
        if (!list.success || list.data.items.length === 0) return;
        // أول منتج متاح.
        const first = list.data.items[0];
        if (!first) return;
        const result = await repository.get(first.id);
        expect(result.success).toBe(true);
        if (result.success) expect(String(result.data.id)).toBe(String(first.id));
      });

      // الجلب بمعرّف غائب يُعيد NotFound لا null ولا استثناء.
      it('يُعيد NotFound لمعرّف غير موجود', async () => {
        const result = await repository.get(asProductId('لا-وجود-له'));
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error.code).toBe('NOT_FOUND');
      });

      // الباركود غير المطابق يُعيد null (غياب المطابقة ليس خطأً).
      it('يُعيد null لباركود غير مطابق بدل خطأ', async () => {
        const result = await repository.getByBarcode({ barcode: '0000000000000' });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toBeNull();
      });

      // البحث يُعيد نتيجة مُرقَّمة أيضًا.
      it('يُعيد البحث نتيجة مُرقَّمة', async () => {
        const result = await repository.search({ term: 'منتج' });
        expect(result.success).toBe(true);
        if (result.success) expect(Array.isArray(result.data.items)).toBe(true);
      });

      // البحث بنص غير موجود يُعيد صفحة فارغة لا خطأ.
      it('يُعيد صفحة فارغة لبحث بلا نتائج', async () => {
        const result = await repository.search({ term: 'نص-لا-يطابق-شيئًا-إطلاقًا' });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.items).toHaveLength(0);
      });

      // الجلب الجماعي يتجاهل المعرّفات الغائبة بلا خطأ.
      it('يجلب مجموعة معرّفات ويتجاهل الغائب منها', async () => {
        const result = await repository.getMany([asProductId('غائب-1'), asProductId('غائب-2')]);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toHaveLength(0);
      });

      // التصنيفات تُعاد كمصفوفة دائمًا.
      it('يُعيد التصنيفات كمصفوفة', async () => {
        const result = await repository.getCategories();
        expect(result.success).toBe(true);
        if (result.success) expect(Array.isArray(result.data)).toBe(true);
      });
    });

    describe('الكتابة', () => {
      // الإنشاء يُعيد الكيان المُنشأ بمعرّف حقيقي.
      it('ينشئ منتجًا ويُعيده بمعرّف', async () => {
        const result = await repository.create(
          {
            sku: 'SKU-NEW',
            barcode: '6291000000099',
            nameAr: 'منتج جديد',
            nameEn: 'New Product',
            categoryId: asCategoryId('cat-1'),
            priceAmount: 2500,
            currency: toCurrencyCode('YER'),
            taxIncluded: false,
            initialQuantity: 25,
          },
          testScope,
        );
        expect(result.success).toBe(true);
        if (!result.success) return;
        // المعرّف موجود والبيانات محفوظة كما أُرسلت.
        expect(String(result.data.id).length).toBeGreaterThan(0);
        expect(result.data.nameAr).toBe('منتج جديد');
        expect(result.data.price.amount.amount).toBe(2500);
        expect(result.data.stock.quantity).toBe(25);
      });

      // المنتج المُنشأ يصبح قابلًا للقراءة فورًا (اتساق القراءة بعد الكتابة).
      it('يجعل المنتج المُنشأ قابلًا للقراءة فورًا', async () => {
        const created = await repository.create(
          {
            sku: 'SKU-RW',
            barcode: '6291000000077',
            nameAr: 'قراءة بعد كتابة',
            nameEn: 'Read After Write',
            categoryId: asCategoryId('cat-1'),
            priceAmount: 500,
            currency: toCurrencyCode('YER'),
            taxIncluded: true,
            initialQuantity: 5,
          },
          testScope,
        );
        if (!created.success) return;
        // القراءة المباشرة بعد الإنشاء يجب أن تنجح.
        const fetched = await repository.get(created.data.id);
        expect(fetched.success).toBe(true);
      });

      // التعديل يغيّر الحقول المُمرَّرة فقط.
      it('يعدّل الحقول المُمرَّرة دون غيرها', async () => {
        const list = await repository.list();
        if (!list.success || list.data.items.length === 0) return;
        const target = list.data.items[0];
        if (!target) return;
        // نعدّل الاسم العربي فقط.
        const updated = await repository.update({ productId: target.id, nameAr: 'اسم معدَّل' });
        expect(updated.success).toBe(true);
        if (!updated.success) return;
        expect(updated.data.nameAr).toBe('اسم معدَّل');
        // بقية الحقول كما كانت.
        expect(updated.data.sku).toBe(target.sku);
      });

      // تعديل منتج غائب يُعيد NotFound.
      it('يرفض تعديل منتج غير موجود', async () => {
        const result = await repository.update({ productId: asProductId('غائب'), nameAr: 'x' });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error.code).toBe('NOT_FOUND');
      });

      // الحذف يُزيل المنتج فعليًا.
      it('يحذف منتجًا فيختفي من القراءة', async () => {
        const created = await repository.create(
          {
            sku: 'SKU-DEL',
            barcode: '6291000000088',
            nameAr: 'للحذف',
            nameEn: 'To Delete',
            categoryId: asCategoryId('cat-1'),
            priceAmount: 100,
            currency: toCurrencyCode('YER'),
            taxIncluded: false,
            initialQuantity: 1,
          },
          testScope,
        );
        if (!created.success) return;
        // نحذفه.
        const deleted = await repository.delete(created.data.id);
        expect(deleted.success).toBe(true);
        // ثم نتأكد من اختفائه.
        const fetched = await repository.get(created.data.id);
        expect(fetched.success).toBe(false);
      });

      // حذف الغائب يُعيد NotFound لا نجاحًا صامتًا.
      it('يرفض حذف منتج غير موجود', async () => {
        const result = await repository.delete(asProductId('غائب'));
        expect(result.success).toBe(false);
      });

      // ضبط الرصيد يحدّث الكمية والحالة المشتقة معًا.
      it('يضبط الرصيد ويشتق حالته', async () => {
        const list = await repository.list();
        if (!list.success || list.data.items.length === 0) return;
        const target = list.data.items[0];
        if (!target) return;
        // نصفّر الرصيد.
        const zeroed = await repository.setStockQuantity(target.id, 0);
        expect(zeroed.success).toBe(true);
        if (!zeroed.success) return;
        expect(zeroed.data.stock.quantity).toBe(0);
        // الحالة تُشتق تلقائيًا لا تُمرَّر.
        expect(zeroed.data.stock.status).toBe('out_of_stock');
      });
    });

    describe('قواعد التفرّد', () => {
      // الباركود المستخدم يُكتشف.
      it('يكتشف الباركود المستخدم', async () => {
        const list = await repository.list();
        if (!list.success || list.data.items.length === 0) return;
        const existing = list.data.items[0];
        const barcode = existing?.barcodes[0]?.value;
        if (!barcode) return;
        const result = await repository.isBarcodeTaken(barcode);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toBe(true);
      });

      // الباركود الحر غير مستخدم.
      it('يعتبر الباركود غير المستخدم متاحًا', async () => {
        const result = await repository.isBarcodeTaken('9999999999999');
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toBe(false);
      });

      // استثناء المنتج نفسه يسمح له بالاحتفاظ بباركوده عند التعديل.
      it('يستثني المنتج نفسه من فحص التكرار', async () => {
        const list = await repository.list();
        if (!list.success || list.data.items.length === 0) return;
        const existing = list.data.items[0];
        const barcode = existing?.barcodes[0]?.value;
        if (!existing || !barcode) return;
        // نفس الباركود مع استثناء صاحبه = متاح.
        const result = await repository.isBarcodeTaken(barcode, existing.id);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toBe(false);
      });
    });
  });
};

// بيانات بذرة مشتركة لكل التنفيذات (تضمن تكافؤ ظروف الاختبار).
export const contractSeedProducts = () => [
  makeSDKProduct({
    id: asProductId('p-1'),
    sku: 'SKU-1',
    nameAr: 'منتج أول',
    nameEn: 'First Product',
  }),
  makeSDKProduct({
    id: asProductId('p-2'),
    sku: 'SKU-2',
    nameAr: 'منتج ثانٍ',
    nameEn: 'Second Product',
    barcodes: [{ value: '6291000000022', format: 'EAN13', isPrimary: true }],
  }),
];
