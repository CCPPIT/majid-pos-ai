/**
 * خطاف شاشة نقطة البيع (PHASE 11).
 * يدير: تحميل الكتالوج، البحث النصي، فلترة التصنيف، البحث بالباركود (مسح يدوي)،
 * والحالة الموحدة (loading/ready/error/empty). محرك السلة الحقيقي في PHASE 12.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { logger } from '@/core/logging/logger';
import type { ProductsRepository } from '@/data/repositories/products.repository';
import type { Product, ProductCategory, ProductQuery } from '@/domain/products/types';
import { useTenancy } from '@/features/tenancy/tenancy-context';

// حالة شاشة نقطة البيع.
export type PosStatus =
  | { kind: 'loading' }
  | { kind: 'ready' } // بيانات جاهزة (القائمة في products).
  | { kind: 'error'; messageKey: string };

// ما يعرضه الخطاف.
export interface PosViewModel {
  status: PosStatus; // الحالة.
  products: Product[]; // المنتجات المعروضة.
  categories: ProductCategory[]; // التصنيفات.
  search: string; // نص البحث.
  categoryId: string | null; // التصنيف المختار (null = الكل).
  isEmpty: boolean; // لا نتائج؟
  barcodeFeedback: { found: boolean; label: string } | null; // نتيجة مسح الباركود.
  currency: string; // العملة.
  setSearch: (value: string) => void;
  selectCategory: (id: string | null) => void;
  onBarcodeScanned: (code: string) => void; // عند إدخال/مسح باركود.
  clearBarcodeFeedback: () => void;
  refresh: () => Promise<void>;
}

export function usePos(repository: ProductsRepository): PosViewModel {
  const tenancy = useTenancy(); // نطاق المتجر النشط.
  const [status, setStatus] = useState<PosStatus>({ kind: 'loading' });
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [barcodeFeedback, setBarcodeFeedback] = useState<PosViewModel['barcodeFeedback']>(null);
  const currency = tenancy.context?.currency ?? 'YER';

  // تحميل الكتالوج المفلتر حسب حالة البحث/التصنيف والنطاق.
  const load = useCallback(async () => {
    setStatus({ kind: 'loading' });
    try {
      const query: ProductQuery = {
        search: search.trim() || undefined,
        categoryId: categoryId ?? undefined,
        storeId: tenancy.context?.storeId,
        branchId: tenancy.context?.branchId,
      };
      const result = await repository.searchProducts(query);
      setProducts(result.products);
      setCategories(result.categories);
      setStatus({ kind: 'ready' });
    } catch (error) {
      logger.error('POS catalog load failed', { error: String(error) });
      setStatus({ kind: 'error', messageKey: 'pos.loadFailed' });
    }
  }, [repository, search, categoryId, tenancy.context]);

  // نحمّل/نعيد التحميل عند تغير البحث/التصنيف أو جاهزية النطاق.
  useEffect(() => {
    if (!tenancy.ready) return;
    Promise.resolve().then(() => load()).catch((error: unknown) => {
      logger.error('POS effect failed', { error: String(error) });
    });
  }, [load, tenancy.ready]);

  // لا نتائج؟ (فقط في الحالة الجاهزة).
  const isEmpty = useMemo(() => status.kind === 'ready' && products.length === 0, [status, products]);

  // اختيار التصنيف (null = الكل).
  const selectCategory = useCallback((id: string | null) => {
    setBarcodeFeedback(null);
    setCategoryId(id);
  }, []);

  // تعديل نص البحث (يمسح تغذية الباركود السابقة).
  const updateSearch = useCallback((value: string) => {
    setBarcodeFeedback(null);
    setSearch(value);
  }, []);

  // مسح/إدخال باركود: نتحقق ونضع تغذية (وصول للمنتج في PHASE 12/الماسح لاحقًا).
  const onBarcodeScanned = useCallback(
    (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;
      const found = products.find((pr) => pr.barcode === trimmed);
      if (found) {
        setBarcodeFeedback({ found: true, label: found.nameAr });
        // نضيّق العرض للمنتج الممسوح.
        setSearch(found.barcode);
      } else {
        setBarcodeFeedback({ found: false, label: trimmed });
        setSearch('');
      }
    },
    [products],
  );

  const clearBarcodeFeedback = useCallback(() => setBarcodeFeedback(null), []);

  return {
    status,
    products,
    categories,
    search,
    categoryId,
    isEmpty,
    barcodeFeedback,
    currency,
    setSearch: updateSearch,
    selectCategory,
    onBarcodeScanned,
    clearBarcodeFeedback,
    refresh: load,
  };
}
