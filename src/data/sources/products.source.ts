/**
 * مصدر كتالوج المنتجات (PHASE 11).
 * اليوم بيانات تجريبية محلية (Mock) — سلع تجزئة يمنية بالريال اليمني؛
 * لاحقًا تُجلب من API/مزامنة دون تغيير المستودع أو الشاشة.
 */
import { asId } from '@/core/types/domain';
import type { Product, ProductCategory } from '@/domain/products/types';

// بيانات الكتالوج (كتالوج واحد يتشارك على نطاق المستأجر).
export interface CatalogData {
  categories: ProductCategory[]; // التصنيفات.
  products: Product[]; // المنتجات.
}

// التصنيفات التجريبية.
export const DEMO_CATEGORIES: ProductCategory[] = [
  { id: asId('cat-beverages'), nameAr: 'مشروبات', nameEn: 'Beverages', icon: 'cafe-outline' },
  { id: asId('cat-food'), nameAr: 'مواد غذائية', nameEn: 'Food', icon: 'fast-food-outline' },
  { id: asId('cat-snacks'), nameAr: 'وجبات خفيفة', nameEn: 'Snacks', icon: 'ice-cream-outline' },
  { id: asId('cat-household'), nameAr: 'منزلية', nameEn: 'Household', icon: 'water-outline' },
  { id: asId('cat-electronics'), nameAr: 'إلكترونيات', nameEn: 'Electronics', icon: 'phone-portrait-outline' },
];

// الوقت الثابت للبيانات التجريبية.
const TS = '2026-01-01T00:00:00.000Z';

// منشئ منتج مختصر (يقلل التكرار).
function p(
  id: string,
  sku: string,
  barcode: string,
  nameAr: string,
  nameEn: string,
  categoryId: string,
  amount: number,
  stock: number,
  icon: string,
): Product {
  // حالة المخزون تُشتق من الكمية.
  const stockStatus: Product['stockStatus'] = stock <= 0 ? 'out_of_stock' : stock <= 5 ? 'low_stock' : 'in_stock';
  return {
    id: asId(id),
    tenantId: asId('tenant-local'),
    sku,
    barcode,
    nameAr,
    nameEn,
    categoryId: asId(categoryId).toString(),
    price: { amount, currency: 'YER' }, // الأسعار بالريال اليمني.
    taxIncluded: true, // الأسعار شاملة الضريبة.
    stockStatus,
    stockQuantity: stock,
    imageIcon: icon,
    createdAt: TS,
    updatedAt: TS,
  };
}

// المنتجات التجريبية.
export const DEMO_PRODUCTS: Product[] = [
  // مشروبات.
  p('prod-001', 'BVG-001', '6291000000011', 'مياه معدنية 600مل', 'Mineral water 600ml', 'cat-beverages', 300, 120, 'water-outline'),
  p('prod-002', 'BVG-002', '6291000000028', 'مشروب غازي 330مل', 'Soft drink 330ml', 'cat-beverages', 500, 80, 'soda-outline'),
  p('prod-003', 'BVG-003', '6291000000035', 'قهوة سريعة 50جم', 'Instant coffee 50g', 'cat-beverages', 1800, 30, 'cafe-outline'),
  p('prod-004', 'BVG-004', '6291000000042', 'شاي أحمر 250جم', 'Red tea 250g', 'cat-beverages', 1200, 45, 'leaf-outline'),
  // مواد غذائية.
  p('prod-005', 'FOD-001', '6291000000059', 'أرز بسمتي 5كجم', 'Basmati rice 5kg', 'cat-food', 9500, 25, 'nutrition-outline'),
  p('prod-006', 'FOD-002', '6291000000066', 'سكر أبيض 1كجم', 'White sugar 1kg', 'cat-food', 1400, 60, 'cube-outline'),
  p('prod-007', 'FOD-003', '6291000000073', 'زيت دوار الشمس 1لتر', 'Sunflower oil 1L', 'cat-food', 3200, 40, 'flask-outline'),
  p('prod-008', 'FOD-004', '6291000000080', 'طحين قمح 2كجم', 'Wheat flour 2kg', 'cat-food', 2100, 18, 'basket-outline'),
  // وجبات خفيفة.
  p('prod-009', 'SNK-001', '6291000000097', 'بسكويت شوكولاتة', 'Chocolate biscuit', 'cat-snacks', 700, 90, 'ice-cream-outline'),
  p('prod-010', 'SNK-002', '6291000000103', 'شيبس بطاطس عائلي', 'Family potato chips', 'cat-snacks', 900, 70, 'fast-food-outline'),
  p('prod-011', 'SNK-003', '6291000000110', 'علكة بالنعناع', 'Mint gum', 'cat-snacks', 250, 4, 'ellipse-outline'),
  // منزلية.
  p('prod-012', 'HSH-001', '6291000000127', 'صابون غسيل 3قطع', 'Laundry soap 3pk', 'cat-household', 1600, 35, 'water-outline'),
  p('prod-013', 'HSH-002', '6291000000134', 'مناديل ورقية', 'Paper tissues', 'cat-household', 1100, 50, 'copy-outline'),
  // إلكترونيات.
  p('prod-014', 'ELC-001', '6291000000141', 'شاحن سريع USB-C', 'USB-C fast charger', 'cat-electronics', 8500, 12, 'flash-outline'),
  p('prod-015', 'ELC-002', '6291000000158', 'سماعة بلوتوث', 'Bluetooth earphone', 'cat-electronics', 15000, 0, 'headset-outline'),
];

// واجهة المصدر.
export interface ProductsSource {
  // يجلب الكتالوج كاملًا (المستودع يفلتره حسب الاستعلام).
  getCatalog(): Promise<CatalogData>;
}

// مصدر محلي ثابت (Mock) — جاهز للاستبدال بـ API.
export class MockProductsSource implements ProductsSource {
  async getCatalog(): Promise<CatalogData> {
    // نسخة مستقلة حتى لا تُعدل الأصول.
    return {
      categories: JSON.parse(JSON.stringify(DEMO_CATEGORIES)) as ProductCategory[],
      products: JSON.parse(JSON.stringify(DEMO_PRODUCTS)) as Product[],
    };
  }
}
