import { pluralKey, translate, translatePlural } from '@/i18n/translate';

describe('translate', () => {
  it('resolves Arabic and English catalogs', () => {
    expect(translate('ar', 'common.signOut')).toBe('تسجيل الخروج');
    expect(translate('en', 'common.signOut')).toBe('Sign out');
  });

  it('interpolates params', () => {
    expect(translate('ar', 'placeholder.phase', { phase: 'PHASE 09' })).toBe(
      'قيد التجهيز — PHASE 09',
    );
  });

  it('falls back to English then the key when missing', () => {
    expect(translate('ar', 'does.not.exist')).toBe('does.not.exist');
  });

  it('keeps unknown interpolation tokens intact', () => {
    expect(translate('en', 'onboarding.getStarted')).toBe('Get started');
  });
});

describe('plurals', () => {
  it('Arabic has zero/one/two/many forms', () => {
    expect(pluralKey('ar', 'cart.items', 0)).toBe('cart.items.zero');
    expect(pluralKey('ar', 'cart.items', 1)).toBe('cart.items.one');
    expect(pluralKey('ar', 'cart.items', 2)).toBe('cart.items.two');
    expect(pluralKey('ar', 'cart.items', 5)).toBe('cart.items.many');
  });

  it('English has one/many forms', () => {
    expect(pluralKey('en', 'cart.items', 1)).toBe('cart.items.one');
    expect(pluralKey('en', 'cart.items', 3)).toBe('cart.items.many');
  });

  it('translatePlural falls back to the key when no plural exists', () => {
    expect(translatePlural('ar', 'nope.missing', 1)).toBe('nope.missing.one');
  });
});
