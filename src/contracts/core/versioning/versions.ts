/**
 * إصدارات الـSDK والعقود — PHASE 32 · أقسام 09 و10 و11.
 *
 * مصدر الحقيقة الوحيد للأرقام (Single Source of Truth): لا يُكتب رقم
 * إصدار في ملف عشوائي. كل مجال يملك نسخة عقد مستقلة (قسم 10) حتى لا
 * نضطر لرفع MAJOR لكامل الـSDK بسبب تغيير مجال واحد.
 *
 *  • SDK_VERSION: نسخة حزمة الـSDK الكلية (قسم 09).
 *  • API_VERSION: نسخة واجهة الـAPI المستقبلية (قسم 11 — أساس فقط بلا خادم).
 *  • DOMAIN_CONTRACT_VERSIONS: نسخة كل مجال على حدة (قسم 10).
 */

// نسخة حزمة الـSDK — المصدر الموحّد (يعيد الـSDK تصديرها).
export const SDK_VERSION = '1.1.0' as const;

// المرحلة التي رفعت فيها النسخة (توثيق تاريخي).
export const SDK_PHASE = 32 as const;

// نسخة واجهة الـAPI (قسم 11: تستوعب v1/v2/v3 مستقبلًا دون إعادة بناء).
export const API_VERSION = 'v1' as const;

// نسخة العقود الكلية (مظلة فوق نسخ المجالات).
export const CONTRACTS_VERSION = '1.0.0' as const;

/**
 * نسخ عقود المجالات المستقلة — قسم 10.
 * كل مجال يتطوّر بإصداره: تغيير كاسر في payments يرفع نسخته وحدها.
 * القيم كلها 1.0.0 الآن لأن PHASE 32 هي أول عقود مستقرة موحّدة.
 */
export const DOMAIN_CONTRACT_VERSIONS = {
  core: '1.0.0', // النواة المشتركة.
  auth: '1.0.0', // المصادقة.
  identity: '1.0.0', // الهوية.
  rbac: '1.0.0', // الصلاحيات.
  tenancy: '1.0.0', // تعدد المستأجرين.
  organization: '1.0.0', // المؤسسات.
  store: '1.0.0', // المتاجر.
  pos: '1.0.0', // نقطة البيع.
  cart: '1.0.0', // السلة.
  products: '1.0.0', // المنتجات.
  // المبيعات في نسختها الرئيسية الثانية: المثال المرجعي للتطوّر الكاسر
  // (totalAmount الخام ← total: Money) مع مسار ترحيل V1→V2 (قسم 78).
  sales: '2.0.0', // المبيعات.
  payments: '1.0.0', // المدفوعات.
  inventory: '1.0.0', // المخزون.
  procurement: '1.0.0', // المشتريات.
  finance: '1.0.0', // المالية.
  customers: '1.0.0', // العملاء.
  crm: '1.0.0', // إدارة العلاقة.
  hr: '1.0.0', // الموارد البشرية.
  analytics: '1.0.0', // التحليلات.
  ai: '1.0.0', // الذكاء الاصطناعي (تجريبي جزئيًا).
  notifications: '1.0.0', // الإشعارات.
} as const;

// نوع اسم المجال (مفاتيح الخريطة أعلاه).
export type DomainName = keyof typeof DOMAIN_CONTRACT_VERSIONS;

// قائمة مجالات المنصّة كقيم ثابتة (للتكرار في السجل والاختبارات).
export const DOMAIN_NAMES = Object.keys(DOMAIN_CONTRACT_VERSIONS) as readonly DomainName[];

// يُعيد نسخة العقد الحالية لمجال معيّن.
export const domainContractVersion = (domain: DomainName): string =>
  DOMAIN_CONTRACT_VERSIONS[domain];

// نسخة واجهة الـAPI كرقم دلالي (للتسجيل ومصفوفة التوافق).
export const API_SEMVER = '1.0.0' as const;

// فضاء أسماء العقود المنطقي — قسم 44 (منطقي داخل src بلا حزم منفصلة).
export const CONTRACT_NAMESPACE = '@majid/contracts' as const;

// يبني اسم العقد الموحّد من المجال واسم الكيان (قسم 44).
export const contractName = (domain: DomainName, entity: string): string =>
  `${CONTRACT_NAMESPACE}/${domain}/${entity}`;
