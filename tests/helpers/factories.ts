/**
 * أدوات بناء بيانات الاختبار المشتركة (PHASE 28).
 * مصانع نقية تُنشئ منتجًا/سلة/مدخلات طلب بشكل متسق عبر اختبارات الوحدة
 * والتكامل، بدل تكرار التهيئة في كل ملف. كل دالة بتعليق عربي.
 */
import { asId } from '@/core/types/domain';
import { addItem, computeTotals, emptyCart } from '@/domain/cart';
import type { Cart, CartTotals } from '@/domain/cart';
import { walkInCustomer } from '@/domain/sales/order';
import type { CreateOrderInput } from '@/domain/sales/types';
import type { Product } from '@/domain/products/types';

// يبني منتج اختبار بقيم قابلة للتخصيص.
export function makeProduct(over: Partial<Product> = {}): Product {
  return {
    id: asId('p-test'),
    tenantId: asId('t-test'),
    sku: 'SKU-TEST',
    barcode: '6291000000011',
    nameAr: 'منتج تجريبي',
    nameEn: 'Test product',
    categoryId: 'cat-test',
    price: { amount: 1000, currency: 'YER' },
    taxIncluded: true,
    stockStatus: 'in_stock',
    stockQuantity: 100,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  } as Product;
}

// يبني سلة فيها منتج واحد بكمية محددة.
export function makeCart(product: Product = makeProduct(), quantity = 1, currency = 'YER'): Cart {
  return addItem(emptyCart(currency), product, quantity);
}

// يحسب مجاميع السلة بنسبة ضريبة محددة.
export function makeTotals(cart: Cart, taxRatePercent = 5): CartTotals {
  return computeTotals(cart, taxRatePercent);
}

// يبني مدخلات إنشاء طلب افتراضية (الرقم المتسلسل يُحقن في المستودع).
export function makeOrderInput(over: Partial<CreateOrderInput> = {}): Omit<CreateOrderInput, 'sequence'> {
  return {
    storeId: asId('store-test'),
    cashierName: 'ماجد',
    customer: walkInCustomer(),
    taxRatePercent: 5,
    ...over,
  };
}
