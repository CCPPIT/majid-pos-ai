/**
 * fixtures العقود (مُنسَّخة) — PHASE 32 · أقسام 55 · 56 · 72 · 78.
 *
 * كل fixture يحمل نسخته صراحةً، وتُستخدم في اختبارات:
 *  • التحقّق السليم/غير السليم (valid · invalid · missing · wrong type).
 *  • المجهول/القديم/الجديد (unknown enum · old version · new version).
 *  • الترحيل الحتمي V1 → V2 (قسم 78).
 *  • العقود الذهبية (Golden) التي تفشل عند أي تغيير غير مقصود (قسم 56).
 */

// ── فاتورة V1 (الشكل القديم: إجمالي خام + عملة منفصلة) ──
export const saleV1Fixture = Object.freeze({
  id: 'sale-0001',
  saleNumber: 'ORD-0001',
  totalAmount: 12500,
  currency: 'YER',
  customerName: 'عميل نقدي',
});

// ── فاتورة V2 بعد الترحيل (الشكل الحالي: total ككائن Money) ──
export const saleV2Fixture = Object.freeze({
  id: 'sale-0001',
  saleNumber: 'ORD-0001',
  total: { amount: 12500, currency: 'YER' },
  customerName: 'عميل نقدي',
});

// ── منتج صالح ──
export const validProductFixture = Object.freeze({
  id: 'prod-1',
  tenantId: 'tenant-1',
  sku: 'SKU-1',
  nameAr: 'قهوة',
  nameEn: 'Coffee',
  barcode: '6291000000011',
  priceAmount: 500,
  currency: 'YER',
  taxIncluded: true,
  active: true,
});

// ── منتج غير صالح (سعر سالب + حقل ناقص) ──
export const invalidProductFixture = Object.freeze({
  id: 'prod-2',
  tenantId: 'tenant-1',
  sku: 'SKU-2',
  nameAr: 'شاي',
  // nameEn مفقود (إلزامي).
  priceAmount: -50, // سالب (غير صالح).
  currency: 'YER',
  taxIncluded: true,
  active: true,
});

// ── دفعة صالح ──
export const validPaymentFixture = Object.freeze({
  id: 'pay-1',
  saleId: 'sale-0001',
  method: 'cash',
  amount: 12500,
  currency: 'YER',
  status: 'completed',
});

// ── دفعة بطريقة مستقبلية مجهولة (wallet) — يجب ألا تكسر (قسم 25) ──
export const futurePaymentMethodFixture = Object.freeze({
  ...validPaymentFixture,
  id: 'pay-2',
  method: 'wallet',
});

// ── صنف مخزون صالح ──
export const validStockItemFixture = Object.freeze({
  id: 'stock-1',
  productId: 'prod-1',
  quantity: 10,
  lowStockThreshold: 3,
});

// ── عميل صالح ──
export const validCustomerFixture = Object.freeze({
  id: 'cust-1',
  nameAr: 'محمد',
  phone: '777123456',
  loyaltyPoints: 0,
});

// ── مخرجات ذكاء صالحة (بعد التحقق — قسم 24) ──
export const validAIOutputFixture = Object.freeze({
  intent: 'add_to_cart',
  confidence: 0.92,
  suggestedAction: { type: 'add_product', productId: 'prod-1', quantity: 2 },
  message: 'أضفت منتجين إلى السلة',
});

// ── مخرجات ذكاء غير صالحة (ثقة خارج المدى + نوع إجراء مجهول) ──
export const invalidAIOutputFixture = Object.freeze({
  intent: 'add_to_cart',
  confidence: 1.5, // أكبر من 1 (غير صالح).
  suggestedAction: { type: 'hack_database' }, // نوع غير مسموح.
  message: '',
});
