/**
 * شاشة إدارة المنتجات (PHASE 16).
 * قائمة الكتالوج مع بحث، إضافة منتج جديد (FAB)، تعديل/حذف لكل منتج —
 * محمية بصلاحيات products.read/create/update/delete (إخفاء + ربط شاشة).
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/design-system/primitives/Screen';
import { Card } from '@/design-system/primitives/Card';
import { SearchInput } from '@/design-system/primitives/SearchInput';
import { EmptyState } from '@/design-system/primitives/EmptyState';
import { Skeleton } from '@/design-system/primitives/Skeleton';
import { Badge } from '@/design-system/primitives/Badge';
import { Dialog } from '@/design-system/primitives/Dialog';
import { useToast } from '@/design-system/primitives/Toast';
import { useTheme } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { toneColors } from '@/design-system/tokens/colors';
import { useTranslation, useLocale } from '@/i18n/LocaleProvider';
import { productsRepository } from '@/shared/container';
import { LIST_PERFORMANCE } from '@/shared/performance/list';
import { useTenancy } from '@/features/tenancy/tenancy-context';
import { useBootstrap } from '@/features/bootstrap/bootstrap-context';
import { hasPermission } from '@/security/permissions/permission';
import { PermissionGuard } from '@/shared/navigation/PermissionGuard';
import { logger } from '@/core/logging/logger';
import { asId } from '@/core/types/domain';
import type { Product, ProductCategory } from '@/domain/products/types';
import type { ProductDraft } from '@/domain/products/validation';
import { productToDraft } from '@/domain/products/factory';
import { ProductFormSheet } from './ProductFormSheet';

// نموذج فارغ لمنتج جديد.
function emptyDraft(currency: string, firstCategory: string): ProductDraft {
  return {
    nameAr: '',
    nameEn: '',
    barcode: '',
    sku: '',
    categoryId: firstCategory,
    priceAmount: '',
    currency,
    taxIncluded: true,
    stockQuantity: '0',
    imageIcon: 'cube-outline',
  };
}

type ListStatus = 'loading' | 'ready' | 'error';

function ProductsManager() {
  const router = useRouter();
  const toast = useToast();
  const { t, formatCurrency } = useTranslation();
  const { locale } = useLocale();
  const { colors } = useTheme();
  const tenancy = useTenancy();
  const { state } = useBootstrap();
  const permissions = state.session?.permissions ?? []; // صلاحيات الجلسة.

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ListStatus>('loading');
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [formKey, setFormKey] = useState(0); // مفتاح لإعادة تركيب النموذج لكل فتح.
  const [deleting, setDeleting] = useState<Product | null>(null);

  // صلاحيات الإدارة (الإخفاء في الواجهة + الفحص عند التنفيذ).
  const canCreate = hasPermission(permissions, 'products.create');
  const canUpdate = hasPermission(permissions, 'products.update');
  const canDelete = hasPermission(permissions, 'products.delete');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const result = await productsRepository.searchProducts({
        search: search.trim() || undefined,
        storeId: tenancy.context?.storeId,
        branchId: tenancy.context?.branchId,
      });
      setProducts(result.products);
      setCategories(result.categories);
      setStatus('ready');
    } catch (error) {
      logger.error('Products management load failed', { error: String(error) });
      setStatus('error');
    }
  }, [search, tenancy.context]);

  useEffect(() => {
    if (!tenancy.ready) return;
    Promise.resolve()
      .then(() => load())
      .catch((error: unknown) => logger.error('Products effect failed', { error: String(error) }));
  }, [tenancy.ready, load]);

  // إضافة منتج جديد.
  const openCreate = () => {
    setEditing(null);
    setFormKey((k) => k + 1);
    setFormVisible(true);
  };
  // تعديل منتج.
  const openEdit = (product: Product) => {
    setEditing(product);
    setFormKey((k) => k + 1);
    setFormVisible(true);
  };

  // القيم الأولية للنموذج (إنشاء/تعديل).
  const initialDraft: ProductDraft = editing
    ? productToDraft(editing)
    : emptyDraft(tenancy.context?.currency ?? 'YER', String(categories[0]?.id ?? ''));

  // حفظ (إنشاء أو تعديل) — الحماية عند التنفيذ لا الإخفاء فقط.
  const handleSave = async (draft: ProductDraft) => {
    if (editing ? !canUpdate : !canCreate) {
      toast.show(t('accessDenied.message'), 'danger');
      return;
    }
    const ctx = {
      tenantId: tenancy.context?.tenantId ?? asId('tenant-local'),
      organizationId: tenancy.context?.organizationId,
      branchId: tenancy.context?.branchId,
      storeId: tenancy.context?.storeId,
      sequence: 0,
    };
    if (editing) {
      await productsRepository.updateProduct(editing, draft);
      toast.show(t('products.updated'), 'success');
    } else {
      await productsRepository.createProduct(draft, ctx);
      toast.show(t('products.created'), 'success');
    }
    await load();
  };

  // تأكيد الحذف — الحماية عند التنفيذ.
  const confirmDelete = async () => {
    if (!deleting) return;
    if (!canDelete) {
      toast.show(t('accessDenied.message'), 'danger');
      setDeleting(null);
      return;
    }
    try {
      await productsRepository.deleteProduct(deleting.id);
      toast.show(t('products.deleted'), 'success');
      setDeleting(null);
      await load();
    } catch {
      toast.show(t('products.error.deleteFailed'), 'danger');
    }
  };

  const renderItem = ({ item }: { item: Product }) => {
    const name = locale === 'ar' ? item.nameAr : item.nameEn;
    const statusInfo =
      item.stockStatus === 'out_of_stock'
        ? { key: 'pos.outOfStock', tone: 'danger' as const }
        : item.stockStatus === 'low_stock'
          ? { key: 'pos.lowStock', tone: 'warning' as const }
          : { key: 'pos.inStock', tone: 'success' as const };
    const palette = toneColors(colors, statusInfo.tone);
    return (
      <Card glass style={styles.card}>
        <View style={styles.cardRow}>
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name={(item.imageIcon ?? 'cube-outline') as never} size={22} color={colors.primary} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{name}</Text>
            <Text style={[styles.barcode, { color: colors.textSubtle }]} numberOfLines={1}>{item.barcode}</Text>
            <View style={styles.metaRow}>
              <Text style={[styles.price, { color: colors.primary }]}>
                {formatCurrency(item.price.amount, item.price.currency)}
              </Text>
              <Badge label={t(statusInfo.key)} tone={statusInfo.tone} />
              <Text style={[styles.stock, { color: palette.strong }]}>
                {t('products.stock')}: {item.stockQuantity}
              </Text>
            </View>
          </View>
        </View>
        {/* إجراءات التعديل/الحذف (تظهر بصلاحية فقط) */}
        {canUpdate || canDelete ? (
          <View style={styles.actions}>
            {canUpdate ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('products.edit')}
                onPress={() => openEdit(item)}
                style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
              >
                <Ionicons name="create-outline" size={18} color={colors.primary} />
                <Text style={[styles.actionText, { color: colors.primary }]}>{t('products.edit')}</Text>
              </Pressable>
            ) : null}
            {canDelete ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('products.delete')}
                onPress={() => setDeleting(item)}
                style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={[styles.actionText, { color: colors.danger }]}>{t('products.delete')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </Card>
    );
  };

  return (
    <Screen edges={['top']} padded={false}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>{t('products.title')}</Text>
        </View>
        <SearchInput value={search} onChangeText={setSearch} placeholder={t('products.searchPh')} />
      </View>

      {status === 'loading' ? (
        <View style={styles.body}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={110} radiusToken="lg" />)}
        </View>
      ) : status === 'error' ? (
        <View style={styles.stateWrap}>
          <EmptyState icon="cloud-offline-outline" title={t('products.errorTitle')} description={t('products.loadFailed')} actionLabel={t('common.retry')} onAction={() => void load()} />
        </View>
      ) : products.length === 0 ? (
        <View style={styles.stateWrap}>
          <EmptyState icon="cube-outline" title={t('products.emptyTitle')} description={t('products.emptyDescription')}
            actionLabel={canCreate ? t('products.add') : undefined} onAction={canCreate ? openCreate : undefined} />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          // تحسين أداء تمرير الكتالوج (PHASE 29): نافذة محدودة + تفريغ الصفوف.
          initialNumToRender={LIST_PERFORMANCE.initialNumToRender}
          maxToRenderPerBatch={LIST_PERFORMANCE.maxToRenderPerBatch}
          windowSize={LIST_PERFORMANCE.windowSize}
          removeClippedSubviews={LIST_PERFORMANCE.removeClippedSubviews}
          updateCellsBatchingPeriod={LIST_PERFORMANCE.updateCellsBatchingPeriod}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} tintColor={colors.primary} />}
        />
      )}

      {/* زر إضافة عائم (FAB) — يظهر بصلاحية الإنشاء فقط */}
      {canCreate ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('products.add')}
          onPress={openCreate}
          style={({ pressed }) => [styles.fab, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Ionicons name="add" size={28} color={colors.primaryContrast} />
        </Pressable>
      ) : null}

      {/* ورقة النموذج — تُعاد التركيب بمفتاح لكل فتح لتُهيّأ القيم من جديد */}
      <ProductFormSheet
        key={formKey}
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        categories={categories}
        currency={tenancy.context?.currency ?? 'YER'}
        initial={initialDraft}
        editing={editing}
        onSave={handleSave}
      />

      {/* تأكيد الحذف */}
      <Dialog
        visible={!!deleting}
        title={t('products.deleteTitle')}
        message={t('products.deleteConfirm', { name: locale === 'ar' ? deleting?.nameAr ?? '' : deleting?.nameEn ?? '' })}
        confirmLabel={t('products.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </Screen>
  );
}

// الشاشة الخارجية: تفرض صلاحية القراءة على مستوى الشاشة (حماية لا إخفاء فقط).
export function ProductsScreen() {
  const { state } = useBootstrap();
  const permissions = state.session?.permissions ?? [];
  return (
    <PermissionGuard permissions={permissions} required="products.read">
      <ProductsManager />
    </PermissionGuard>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.md, paddingBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSize['2xl'], fontWeight: '800' },
  body: { padding: spacing.xl, gap: spacing.md },
  list: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing['6xl'] },
  stateWrap: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  cardRow: { flexDirection: 'row', gap: spacing.md },
  iconBox: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, gap: 2 },
  name: { fontSize: fontSize.md, fontWeight: '800' },
  barcode: { fontSize: fontSize.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginTop: 2 },
  price: { fontSize: fontSize.md, fontWeight: '900' },
  stock: { fontSize: fontSize.xs, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, flex: 1, justifyContent: 'center' },
  actionText: { fontSize: fontSize.sm, fontWeight: '700' },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    end: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
