/**
 * اختبارات وحدة أداء القوائم (PHASE 29).
 * تغطي الدوال النقية: ثبات المفاتيح، مقارنة صفوف memo، حساب إزاحات الصفوف
 * الثابتة (getItemLayout)، وصحة قيم النافذة الافتراضية.
 */
import {
  LIST_PERFORMANCE,
  stableKey,
  stableKeyWithPrefix,
  sameRowIdentity,
  fixedRowOffset,
  makeFixedLayout,
} from '@/shared/performance/list';

describe('LIST_PERFORMANCE defaults', () => {
  test('uses conservative windowing values', () => {
    expect(LIST_PERFORMANCE.initialNumToRender).toBeGreaterThan(0);
    expect(LIST_PERFORMANCE.maxToRenderPerBatch).toBeGreaterThan(0);
    expect(LIST_PERFORMANCE.windowSize).toBeGreaterThan(0);
    expect(LIST_PERFORMANCE.removeClippedSubviews).toBe(true);
  });
});

describe('stableKey', () => {
  test('stringifies id consistently', () => {
    expect(stableKey({ id: 'a1' })).toBe('a1');
    expect(stableKey({ id: 42 })).toBe('42');
  });

  test('prefixed key namespaces items', () => {
    const keyFor = stableKeyWithPrefix('row');
    expect(keyFor({ id: 'x' })).toBe('row-x');
    expect(keyFor({ id: 7 })).toBe('row-7');
  });
});

describe('sameRowIdentity (React.memo comparator)', () => {
  test('true when id unchanged, false when it changes', () => {
    expect(sameRowIdentity({ item: { id: 'a' } }, { item: { id: 'a' } })).toBe(true);
    expect(sameRowIdentity({ item: { id: 'a' } }, { item: { id: 'b' } })).toBe(false);
    // رقم ونص بنفس القيمة يُعتبران متطابقين.
    expect(sameRowIdentity({ item: { id: 3 } }, { item: { id: '3' } })).toBe(true);
  });
});

describe('fixedRowOffset / makeFixedLayout', () => {
  test('offset = header + index * rowHeight', () => {
    const sizing = { itemHeight: 80, headerHeight: 120 };
    expect(fixedRowOffset(0, sizing)).toBe(120);
    expect(fixedRowOffset(1, sizing)).toBe(200);
    expect(fixedRowOffset(3, sizing)).toBe(360);
  });

  test('header defaults to zero', () => {
    const sizing = { itemHeight: 50 };
    expect(fixedRowOffset(2, sizing)).toBe(100);
  });

  test('makeFixedLayout returns length/offset/index for FlatList', () => {
    const layout = makeFixedLayout<unknown>({ itemHeight: 64, headerHeight: 100 });
    const at0 = layout([], 0);
    const at5 = layout([], 5);
    expect(at0).toEqual({ length: 64, offset: 100, index: 0 });
    expect(at5).toEqual({ length: 64, offset: 420, index: 5 });
  });
});
