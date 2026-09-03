/**
 * الواجهة العلنية لمجال المنتجات — PHASE 31 · قسم 51.
 */

// كيانات المجال.
export {
  productName,
  primaryBarcode,
  type Product,
  type ProductCategory,
  type ProductVariant,
  type ProductPrice,
  type ProductCost,
  type ProductStockSummary,
  type Barcode,
  type StockStatus,
} from './contracts/product-contracts';

// الأوامر والاستعلامات.
export type {
  ProductListQuery,
  ProductSearchQuery,
  ProductBarcodeQuery,
  CreateProductCommand,
  UpdateProductCommand,
  DeleteProductCommand,
} from './contracts/product-queries';

// عقد المستودع.
export type { ProductRepository } from './contracts/product-repository';

// مخططات التحقق وأدواتها المشتركة.
export {
  createProductSchema,
  updateProductSchema,
  deleteProductSchema,
  productSearchSchema,
  productBarcodeSchema,
  currencySchema,
  barcodeSchema,
  skuSchema,
  priceAmountSchema,
  quantitySchema,
  validateWith,
  toValidationError,
} from './contracts/product-schemas';

// المحوّلات (DTO ⇄ Domain ⇄ Legacy).
export {
  productFromDTO,
  productToDTO,
  productFromLegacy,
  productToLegacy,
  categoryFromDTO,
  deriveStockStatus,
  DEFAULT_LOW_STOCK_THRESHOLD,
  type ProductDTO,
  type ProductCategoryDTO,
} from './mappers/product-mapper';

// منطق الاستعلام النقي.
export {
  applyProductQuery,
  applyProductSearch,
  matchesSearchTerm,
  matchesBarcode,
  normalizeSearchText,
  usedCategoryIds,
} from './queries/product-query-logic';

// الخدمة والتنفيذ المحلي.
export { createProductService, type ProductService, type ProductServiceDependencies } from './services/product-service';
export {
  createLocalProductRepository,
  type LocalProductRepositoryDependencies,
} from './repositories/local-product-repository';
