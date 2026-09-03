/**
 * حارس اكتمال مفاتيح الترجمة للـSDK — PHASE 31 · قسم 46.
 *
 * الـSDK لا يُصدر نصوصًا للمستخدم، بل **مفاتيح ترجمة**. لو أضاف أحدهم
 * خطأً جديدًا بمفتاح غير موجود في الفهرسين، لظهر للمستخدم مفتاح خام
 * مثل `sdk.payments.error.x` بدل رسالة مفهومة. هذا الاختبار يقرأ الشيفرة
 * نفسها ويقارنها بالفهرسين، فيكتشف النقص قبل أن يصل للمستخدم.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ar } from '@/i18n/ar';
import { en } from '@/i18n/en';
import { SDK_DOMAIN_EVENTS } from '@/sdk/core';

// جذر شيفرة الـSDK.
const SDK_ROOT = join(__dirname, '../../../src/sdk');

// يجمع مسارات كل ملفات TypeScript داخل مجلد (بحث عميق).
const collectFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    // المسار الكامل للمدخل.
    const full = join(dir, entry);
    // المجلدات تُفحص بالتعمّق.
    if (statSync(full).isDirectory()) return collectFiles(full);
    // ملفات TypeScript وحدها تُقرأ.
    return full.endsWith('.ts') ? [full] : [];
  });

// أسماء أحداث المجال ليست مفاتيح ترجمة رغم بدئها بـ'sdk.' — نستثنيها.
const eventNames = new Set<string>(Object.values(SDK_DOMAIN_EVENTS));

// كل السلاسل التي تبدأ بـ'sdk.' في شيفرة الـSDK.
const referencedKeys = (): readonly string[] => {
  // مجموعة فريدة تمنع التكرار.
  const found = new Set<string>();
  // نمر على كل ملف.
  for (const file of collectFiles(SDK_ROOT)) {
    // محتوى الملف.
    const content = readFileSync(file, 'utf8');
    // كل سلسلة مفردة تبدأ بـ'sdk.'.
    for (const match of content.matchAll(/'(sdk\.[a-zA-Z0-9_.]+)'/g)) {
      // النص الملتقط.
      const key = match[1];
      // نتجاهل أسماء الأحداث.
      if (key && !eventNames.has(key)) found.add(key);
    }
  }
  return [...found].sort();
};

describe('SDK i18n — اكتمال المفاتيح', () => {
  // كل مفتاح يذكره الـSDK موجود في الفهرس العربي.
  it('كل مفتاح يستخدمه الـSDK موجود في الفهرس العربي', () => {
    // المفاتيح المفقودة.
    const missing = referencedKeys().filter((key) => !(key in ar));
    expect(missing).toEqual([]);
  });

  // وكذلك في الفهرس الإنجليزي.
  it('كل مفتاح يستخدمه الـSDK موجود في الفهرس الإنجليزي', () => {
    const missing = referencedKeys().filter((key) => !(key in en));
    expect(missing).toEqual([]);
  });

  // الاختبار نفسه يجب أن يجد مفاتيح فعلية (حماية من فحص فارغ كاذب).
  it('يعثر على مفاتيح فعلية في شيفرة الـSDK', () => {
    expect(referencedKeys().length).toBeGreaterThan(50);
  });

  // لا مفتاح SDK بقيمة فارغة في أي لغة.
  it('لا مفتاح SDK بقيمة فارغة', () => {
    // مفاتيح الـSDK في الفهرس العربي.
    const sdkKeys = Object.keys(ar).filter((key) => key.startsWith('sdk.'));
    // لكل واحد قيمة غير فارغة في اللغتين.
    for (const key of sdkKeys) {
      expect(String(ar[key] ?? '').trim().length).toBeGreaterThan(0);
      expect(String(en[key] ?? '').trim().length).toBeGreaterThan(0);
    }
  });
});
