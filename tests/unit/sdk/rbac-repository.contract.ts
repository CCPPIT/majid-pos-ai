/**
 * مواصفة عقد مستودع الصلاحيات — PHASE 31 · قسم 61.
 *
 * تُطبَّق على كل تنفيذ لعقد `RbacRepository` (في الذاكرة · محلي فوق فهرس
 * المنصّة · بعيد لاحقًا). أي تنفيذ يخالف بندًا هنا يسقط، فيستحيل أن
 * يختلف سلوك التفويض باختلاف مصدر الأدوار — وهو فارق أمني لا تجميلي.
 */
import type { RbacRepository } from '@/sdk/rbac';

// مصنع التنفيذ محل الاختبار.
export interface RbacRepositoryFactory {
  readonly name: string; // اسم التنفيذ (يظهر في التقرير).
  // ينشئ نسخة نظيفة قبل كل اختبار.
  create(): Promise<RbacRepository> | RbacRepository;
  // كود دور معروف أنه موجود في هذا التنفيذ (يختلف بين الفهارس).
  readonly knownRoleCode: string;
}

/** يشغّل مواصفة العقد كاملة على تنفيذ محدد. */
export const runRbacRepositoryContract = (factory: RbacRepositoryFactory): void => {
  describe(`عقد RbacRepository — ${factory.name}`, () => {
    // نسخة نظيفة لكل اختبار.
    let repository: RbacRepository;

    beforeEach(async () => {
      repository = await factory.create();
    });

    describe('الأدوار', () => {
      // السرد يُعيد مصفوفة دائمًا.
      it('يُعيد الأدوار كمصفوفة', async () => {
        const result = await repository.getRoles();
        expect(result.success).toBe(true);
        if (result.success) expect(Array.isArray(result.data)).toBe(true);
      });

      // كل دور مكتمل الحقول الإلزامية (لا دور نصف مبني).
      it('يُعيد أدوارًا مكتملة الحقول', async () => {
        const result = await repository.getRoles();
        if (!result.success) return;
        // نفحص كل دور.
        for (const role of result.data) {
          // المعرّف والكود نصّان غير فارغين.
          expect(String(role.id).length).toBeGreaterThan(0);
          expect(role.code.length).toBeGreaterThan(0);
          // الاسمان موجودان (الواجهة ثنائية اللغة).
          expect(role.nameAr.length).toBeGreaterThan(0);
          expect(role.nameEn.length).toBeGreaterThan(0);
          // النطاق من المفردات المعروفة.
          expect(['own', 'store', 'branch', 'organization', 'tenant', 'global']).toContain(role.scope);
          // الصلاحيات مصفوفة (قد تكون فارغة لكنها موجودة).
          expect(Array.isArray(role.permissions)).toBe(true);
        }
      });

      // الجلب بالكود يعمل لكود معروف.
      it('يجلب دورًا بكوده', async () => {
        const result = await repository.getRoleByCode(factory.knownRoleCode);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data?.code).toBe(factory.knownRoleCode);
      });

      // الكود المجهول يُعيد null لا خطأ (الغياب نتيجة مشروعة).
      it('يُعيد null لكود دور مجهول', async () => {
        const result = await repository.getRoleByCode('دور-لا-وجود-له');
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toBeNull();
      });

      // الجلب بالمعرّفات يُعيد المطابق فقط.
      it('يجلب الأدوار بمعرّفاتها', async () => {
        // نقرأ دورًا موجودًا أولًا.
        const all = await repository.getRoles();
        if (!all.success || all.data.length === 0) return;
        const first = all.data[0];
        if (!first) return;
        // ثم نطلبه بمعرّفه.
        const result = await repository.getRolesByIds([first.id]);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveLength(1);
          expect(String(result.data[0]?.id)).toBe(String(first.id));
        }
      });

      // المعرّفات الغائبة تُتجاهل بلا خطأ.
      it('يتجاهل المعرّفات الغائبة بلا خطأ', async () => {
        const result = await repository.getRolesByIds(['لا-يوجد' as never]);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toHaveLength(0);
      });

      // قائمة فارغة تُعيد نتيجة فارغة لا الكل (خطأ شائع خطير أمنيًا).
      it('يُعيد فارغًا لقائمة معرّفات فارغة', async () => {
        const result = await repository.getRolesByIds([]);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toHaveLength(0);
      });
    });

    describe('الصلاحيات والسياسات', () => {
      // الصلاحيات مصفوفة دائمًا.
      it('يُعيد الصلاحيات كمصفوفة', async () => {
        const result = await repository.getPermissions();
        expect(result.success).toBe(true);
        if (result.success) expect(Array.isArray(result.data)).toBe(true);
      });

      // كل إذن مكتمل الحقول.
      it('يُعيد أذونات مكتملة الحقول', async () => {
        const result = await repository.getPermissions();
        if (!result.success) return;
        for (const permission of result.data) {
          // المورد والفعل نصّان غير فارغين.
          expect(permission.resource.length).toBeGreaterThan(0);
          expect(String(permission.action).length).toBeGreaterThan(0);
          // النطاق من المفردات المعروفة.
          expect(['own', 'store', 'branch', 'organization', 'tenant', 'global']).toContain(permission.scope);
        }
      });

      // السياسات مصفوفة دائمًا (فارغة مقبولة، undefined لا).
      it('يُعيد السياسات كمصفوفة', async () => {
        const result = await repository.getPolicies();
        expect(result.success).toBe(true);
        if (result.success) expect(Array.isArray(result.data)).toBe(true);
      });

      // كل سياسة مُعادة تحمل إذنًا وأثرًا صالحين (وإلا تعطّل قرار التفويض).
      it('يُعيد سياسات صالحة البنية', async () => {
        const result = await repository.getPolicies();
        if (!result.success) return;
        for (const policy of result.data) {
          // الإذن الذي تنظّمه نص غير فارغ.
          expect(typeof policy.permission).toBe('string');
          expect(policy.permission.length).toBeGreaterThan(0);
          // الأثر أحد قيمتين لا ثالث لهما.
          expect(['allow', 'deny']).toContain(policy.effect);
        }
      });
    });
  });
};
