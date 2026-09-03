/**
 * تشغيل مواصفة عقد مستودع المنتجات على كل تنفيذاته — PHASE 31 · قسم 61.
 *
 * التنفيذ في الذاكرة (اختبارات) والتنفيذ المحلي (الإنتاج، فوق مستودع
 * التطبيق القائم) يمرّان بنفس المواصفة حرفيًا. أي انحراف بينهما يسقط هنا،
 * وهذا هو الضمان العملي أن استبدال التخزين لاحقًا لن يغيّر السلوك.
 */
import { asTenantId } from '@/sdk/core';
import { createLocalProductRepository } from '@/sdk/products';
import { AppProductsRepository } from '@/data/repositories/products.repository';
import { LocalCatalogSource } from '@/data/sources/local-catalog.source';
import { createInMemoryProductRepository } from '../../helpers/sdk-mocks';
import { contractSeedProducts, runProductRepositoryContract } from './product-repository.contract';

// مخزن مفتاح/قيمة في الذاكرة يغذّي مصدر الكتالوج المحلي (بديل تخزين الجهاز).
const memoryStore = () => {
  // خريطة القيم.
  const data = new Map<string, string>();
  // واجهة المخزن التي يتوقّعها المصدر.
  return {
    getString: async (key: string) => data.get(key) ?? null,
    setString: async (key: string, value: string) => {
      data.set(key, value);
    },
  };
};

// (1) التنفيذ في الذاكرة المستخدم في بقية الاختبارات.
runProductRepositoryContract({
  name: 'InMemoryProductRepository',
  create: () => createInMemoryProductRepository(contractSeedProducts()),
});

// (2) التنفيذ المحلي الحقيقي فوق مستودع التطبيق القائم.
// نفس المواصفة تمامًا — لا تخفيف ولا استثناء.
runProductRepositoryContract({
  name: 'LocalProductRepository (فوق AppProductsRepository)',
  create: () => {
    // مصدر كتالوج نظيف مدعوم بمخزن في الذاكرة.
    const source = new LocalCatalogSource(memoryStore());
    // مستودع التطبيق القائم (غير معدَّل إطلاقًا).
    const legacy = new AppProductsRepository(source);
    // محوّل الـSDK فوقه.
    // المستأجر يُقرأ عند كل عملية (دالة لا قيمة ثابتة).
    return createLocalProductRepository({ legacy, defaultTenantId: () => asTenantId('t-test') });
  },
});
