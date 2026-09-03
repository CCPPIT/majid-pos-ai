/**
 * اختبار اكتمال الترجمة (PHASE 28).
 * يثبت أن فهرسي العربية والإنجليزية يحويان نفس مجموعة المفاتيح تمامًا (لا نص
 * مفقود في لغة)، وأن كل قيمة غير فارغة، وأن المفاتيح الحساسة الجديدة
 * (copilot/agents/security/audit) موجودة في اللغتين — حماية ضد تراجع i18n.
 */
import { ar } from '@/i18n/ar';
import { en } from '@/i18n/en';
import { translate } from '@/i18n/translate';

describe('i18n key parity', () => {
  const arKeys = Object.keys(ar).sort();
  const enKeys = Object.keys(en).sort();

  test('Arabic and English catalogs have identical key sets', () => {
    const missingInEn = arKeys.filter((k) => !(k in en));
    const missingInAr = enKeys.filter((k) => !(k in ar));
    expect(missingInEn).toEqual([]);
    expect(missingInAr).toEqual([]);
  });

  test('every key resolves to a non-empty string in both locales', () => {
    for (const key of arKeys) {
      expect(translate('ar', key).trim().length).toBeGreaterThan(0);
      expect(translate('en', key).trim().length).toBeGreaterThan(0);
    }
  });

  test('interpolation tokens never leak for static feature labels', () => {
    // القيم الثابتة (بلا معاملات) يجب ألّا تُظهر علامات قالب غير مستبدلة.
    const staticKeys = [
      'copilot.title', 'agents.title', 'security.title', 'audit.title',
      'common.back', 'common.retry', 'sync.syncNow',
    ].filter((k): k is string => typeof k === 'string' && k in ar);
    expect(staticKeys.length).toBeGreaterThan(0);
    for (const key of staticKeys) {
      for (const locale of ['ar', 'en'] as const) {
        const out = translate(locale, key);
        expect(out).not.toMatch(/\{\w+\}/); // لا {token} ظاهر.
      }
    }
  });

  test('feature key groups (copilot/agents/security/audit) exist in both locales', () => {
    const groups = ['copilot.', 'agents.', 'security.', 'audit.'];
    for (const prefix of groups) {
      const arCount = arKeys.filter((k) => k.startsWith(prefix)).length;
      const enCount = enKeys.filter((k) => k.startsWith(prefix)).length;
      expect(arCount).toBeGreaterThan(0);
      expect(arCount).toBe(enCount);
    }
  });
});
