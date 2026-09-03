/**
 * عقد مستودع المنتجات — PHASE 31 · قسم 30.
 * واجهة خالصة: كل تنفيذ (محلي · بعيد · مُخزَّن مؤقتًا) يجب أن يحقق نفس العقد
 * ويجتاز نفس اختبارات العقد (قسم 61).
 */
import type {
  AsyncResult,
  CategoryId,
  PaginatedResult,
  ProductId,
  ScopeFilter,
} from '@/sdk/core';
import type { Product, ProductCategory } from './product-contracts';
import type {
  CreateProductCommand,
  ProductBarcodeQuery,
  ProductListQuery,
  ProductSearchQuery,
  UpdateProductCommand,
} from './product-queries';

// مستودع المنتجات: القراءة والكتابة على كيانات المجال (لا DTO في التوقيع).
export interface ProductRepository {
  // يسرد المنتجات مُرقَّمة حسب الاستعلام.
  list(query?: ProductListQuery): AsyncResult<PaginatedResult<Product>>;
  // يجلب منتجًا بالمعرّف (خطأ NotFound عند الغياب).
  get(id: ProductId): AsyncResult<Product>;
  // يبحث نصيًّا (اسم/باركود/SKU).
  search(query: ProductSearchQuery): AsyncResult<PaginatedResult<Product>>;
  // يجلب منتجًا بالباركود (null عند عدم التطابق — ليس خطأً).
  getByBarcode(query: ProductBarcodeQuery): AsyncResult<Product | null>;
  // ينشئ منتجًا جديدًا داخل نطاق محدد.
  create(command: CreateProductCommand, scope: ScopeFilter): AsyncResult<Product>;
  // يعدّل منتجًا قائمًا.
  update(command: UpdateProductCommand): AsyncResult<Product>;
  // يحذف منتجًا.
  delete(id: ProductId): AsyncResult<void>;
  // يسرد التصنيفات المتاحة.
  getCategories(): AsyncResult<readonly ProductCategory[]>;
  // هل الباركود مستخدم من منتج آخر؟ (منع التكرار قبل الإنشاء/التعديل).
  isBarcodeTaken(barcode: string, exceptProductId?: ProductId): AsyncResult<boolean>;
  // يحدّث رصيد منتج (يستدعيه مجال المخزون وحده).
  setStockQuantity(id: ProductId, quantity: number): AsyncResult<Product>;
  // يجلب مجموعة منتجات بمعرّفاتها دفعة واحدة (تفادي استعلامات متكررة — قسم 66).
  getMany(ids: readonly ProductId[]): AsyncResult<readonly Product[]>;
  // يسرد المنتجات ضمن تصنيف محدد.
  listByCategory(categoryId: CategoryId, query?: ProductListQuery): AsyncResult<PaginatedResult<Product>>;
}
