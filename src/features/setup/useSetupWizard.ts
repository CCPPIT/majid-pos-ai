/**
 * منطق معالج إعداد المتجر (PHASE 09).
 * خطاف يدير: الخطوة الحالية، المسودة، التحديثات، الاقتراحات التلقائية
 * (العملة/الضريبة حسب الدولة)، التحقق لكل خطوة، والتقدم.
 */
import { useCallback, useMemo, useState } from 'react';

import {
  DEFAULT_CURRENCY_BY_COUNTRY, // العملة الافتراضية للدولة.
  DEFAULT_TAX_BY_COUNTRY, // الضريبة الافتراضية للدولة.
} from '@/domain/setup/options';
import type {
  BusinessTypeCode, // نوع النشاط.
  CountryCode, // الدولة.
  CurrencyCode, // العملة.
  SetupStepId, // معرف الخطوة.
  StepMeta, // وصف الخطوة.
  StoreSetupProfile, // الملف التعريفي.
} from '@/domain/setup/types';
import { SETUP_STEPS } from '@/domain/setup/types';
import { validateStep } from '@/domain/setup/validation';

// أوصاف الخطوات للعرض (العنوان/الأيقونة عبر مفاتيح ترجمة).
export const STEP_META: StepMeta[] = [
  { id: 'business', titleKey: 'setup.step.business', icon: 'storefront-outline' }, // العمل.
  { id: 'location', titleKey: 'setup.step.location', icon: 'location-outline' }, // الدولة.
  { id: 'tax', titleKey: 'setup.step.tax', icon: 'receipt-outline' }, // الضريبة.
  { id: 'store', titleKey: 'setup.step.store', icon: 'git-branch-outline' }, // الفرع/المتجر.
  { id: 'manager', titleKey: 'setup.step.manager', icon: 'person-outline' }, // المدير.
  { id: 'review', titleKey: 'setup.step.review', icon: 'checkmark-done-outline' }, // المراجعة.
];

// المسار الكامل للمعالج.
export type Draft = Partial<StoreSetupProfile>;

export interface SetupWizard {
  stepIndex: number; // فهرس الخطوة الحالية (0-based).
  step: SetupStepId; // معرف الخطوة الحالية.
  steps: StepMeta[]; // كل الخطوات.
  draft: Draft; // المسودة الحالية.
  isFirstStep: boolean; // هل نحن في الخطوة الأولى؟
  isLastStep: boolean; // هل نحن في الخطوة الأخيرة؟
  canProceed: boolean; // هل زر "التالي" مفعّل؟
  progress: number; // نسبة التقدم 0..1.
  errorKey: string | undefined; // مفتاح رسالة الخطأ للخطوة.
  setField: <K extends keyof StoreSetupProfile>(key: K, value: StoreSetupProfile[K]) => void; // تحديث حقل.
  selectCountry: (country: CountryCode) => void; // اختيار الدولة (يضبط العملة/الضريبة).
  selectBusinessType: (type: BusinessTypeCode) => void; // اختيار نوع النشاط.
  next: () => void; // انتقل للخطوة التالية.
  back: () => void; // ارجع للخطوة السابقة.
  goTo: (index: number) => void; // انتقل لفهرس محدد.
  buildProfile: () => StoreSetupProfile; // ابنِ الملف الكامل من المسودة.
}

// الخطاف الرئيسي للمعالج.
export function useSetupWizard(): SetupWizard {
  const [stepIndex, setStepIndex] = useState(0); // نبدأ من الخطوة الأولى.
  const [draft, setDraft] = useState<Draft>({}); // مسودة فارغة.

  const step: SetupStepId = SETUP_STEPS[stepIndex] ?? 'business'; // الخطوة الحالية (افتراضي الأولى).

  // تحديث حقل واحد في المسودة.
  const setField = useCallback(<K extends keyof StoreSetupProfile>(key: K, value: StoreSetupProfile[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  // اختيار الدولة يضبط تلقائيًا العملة والضريبة (اقتراح قابل للتعديل).
  const selectCountry = useCallback(
    (country: CountryCode) => {
      setDraft((prev) => ({
        ...prev,
        country, // الدولة المختارة.
        currency: DEFAULT_CURRENCY_BY_COUNTRY[country] as CurrencyCode, // عملة مقترحة.
        taxRatePercent: DEFAULT_TAX_BY_COUNTRY[country], // ضريبة مقترحة.
      }));
    },
    [],
  );

  // اختيار نوع النشاط (للراحة).
  const selectBusinessType = useCallback(
    (type: BusinessTypeCode) => setField('businessType', type),
    [setField],
  );

  // تحقق الخطوة الحالية (لتفعيل الزر وعرض الخطأ).
  const validation = useMemo(() => validateStep(step, draft), [step, draft]);

  // هل يمكن الانتقال للتالي؟
  const canProceed = validation.valid;

  // التقدم = (الخطوات المكتملة) / (إجمالي الخطوات - 1).
  const progress = useMemo(() => stepIndex / (SETUP_STEPS.length - 1), [stepIndex]);

  const next = useCallback(() => {
    const current: SetupStepId = SETUP_STEPS[stepIndex] ?? 'business'; // الخطوة الحالية.
    if (!validateStep(current, draft).valid) return; // لا نتجاوز خطوة غير صالحة.
    setStepIndex((i) => Math.min(i + 1, SETUP_STEPS.length - 1)); // تقدم بحد أقصى الأخيرة.
  }, [stepIndex, draft]);

  const back = useCallback(() => {
    setStepIndex((i) => Math.max(i - 1, 0)); // رجوع بحد أدنى الأولى.
  }, []);

  const goTo = useCallback((index: number) => {
    setStepIndex(Math.max(0, Math.min(index, SETUP_STEPS.length - 1))); // ضمن الحدود.
  }, []);

  // بناء الملف الكامل من المسودة (للحفظ في خطوة المراجعة).
  const buildProfile = useCallback((): StoreSetupProfile => {
    return {
      businessName: draft.businessName ?? '',
      businessType: draft.businessType as BusinessTypeCode,
      country: draft.country as CountryCode,
      currency: draft.currency as CurrencyCode,
      taxRatePercent: draft.taxRatePercent ?? 0,
      branchName: draft.branchName ?? '',
      branchCity: draft.branchCity ?? '',
      storeName: draft.storeName ?? '',
      storeCode: draft.storeCode ?? '',
      managerName: draft.managerName ?? '',
      completedAt: new Date().toISOString(),
    };
  }, [draft]);

  return {
    stepIndex,
    step,
    steps: STEP_META,
    draft,
    isFirstStep: stepIndex === 0,
    isLastStep: stepIndex === SETUP_STEPS.length - 1,
    canProceed,
    progress,
    errorKey: validation.errorKey,
    setField,
    selectCountry,
    next,
    back,
    selectBusinessType,
    goTo,
    buildProfile,
  };
}
