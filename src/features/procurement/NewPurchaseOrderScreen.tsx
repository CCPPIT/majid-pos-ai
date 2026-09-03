/**
 * شاشة إنشاء أمر شراء جديد (PHASE 18).
 * اختيار المورّد، إضافة أصناف (بحث من الكتالوج) بكمية وتكلفة وحدة،
 * نسبة ضريبة، ثم إنشاء الأمر كمسودة عبر المستودع.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/design-system/primitives/Screen';
import { Card } from '@/design-system/primitives/Card';
import { Button } from '@/design-system/primitives/Button';
import { Input } from '@/design-system/primitives/Input';
import { Chip } from '@/design-system/primitives/Chip';
import { EmptyState } from '@/design-system/primitives/EmptyState';
import { useToast } from '@/design-system/primitives/Toast';
import { useTheme } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { useTranslation, useLocale } from '@/i18n/LocaleProvider';
import { procurementRepository, productsRepository } from '@/shared/container';
import { useTenancy } from '@/features/tenancy/tenancy-context';
import { useBootstrap } from '@/features/bootstrap/bootstrap-context';
import { logger } from '@/core/logging/logger';
import { asId } from '@/core/types/domain';
import { calculateTotals, type DraftOrderLine, type Supplier } from '@/domain/procurement';
import type { Product as CatalogProduct } from '@/domain/products/types';

// سطر قيد الإضافة في الواجهة.
interface EditingLine {
  product: CatalogProduct; // المنتج المختار.
  quantity: string; // الكمية كنص.
  unitCost: string; // تكلفة الوحدة كنص.
}

export function NewPurchaseOrderScreen() {
  const router = useRouter();
  const toast = useToast();
  const { t, formatCurrency } = useTranslation();
  const { locale } = useLocale();
  const { colors } = useTheme();
  const tenancy = useTenancy();
  const { state } = useBootstrap();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<string>(''); // المورّد المختار.
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<CatalogProduct[]>([]); // نتائج بحث المنتجات.
  const [lines, setLines] = useState<EditingLine[]>([]); // الأسطر المختارة.
  const [taxRate, setTaxRate] = useState('0'); // نسبة الضريبة.
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false); // هل حُمّل المورّدون؟

  const currency = tenancy.context?.currency ?? 'YER';

  // تحميل المورّدين عند أول فتح (عبر effect لا أثناء الرسم).
  useEffect(() => {
    if (loaded) return;
    Promise.resolve()
      .then(async () => {
        const list = await procurementRepository.listSuppliers();
        setSuppliers(list);
        setLoaded(true);
      })
      .catch((error: unknown) => logger.error('Suppliers load failed', { error: String(error) }));
  }, [loaded]);

  // بحث المنتجات من الكتالوج.
  const onSearch = async (text: string) => {
    setSearch(text);
    if (text.trim().length < 1) {
      setResults([]);
      return;
    }
    const result = await productsRepository.searchProducts({ search: text.trim(), storeId: tenancy.context?.storeId });
    setResults(result.products);
  };

  // إضافة منتج للقائمة.
  const addProduct = (product: CatalogProduct) => {
    if (lines.some((l) => String(l.product.id) === String(product.id))) {
      toast.show(t('procurement.alreadyAdded'), 'warning');
      return;
    }
    setLines((prev) => [...prev, { product, quantity: '1', unitCost: String(product.price.amount) }]);
    setSearch('');
    setResults([]);
  };

  // تحديث حقل في سطر.
  const updateLine = (index: number, patch: Partial<EditingLine>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  // حذف سطر.
  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index));

  // الأسطر الخام المحوّلة للمجال.
  const draftLines: DraftOrderLine[] = lines.map((l) => ({
    productId: l.product.id,
    nameAr: l.product.nameAr,
    nameEn: l.product.nameEn,
    sku: l.product.sku,
    barcode: l.product.barcode,
    quantity: Number(l.quantity),
    unitCostAmount: Number(l.unitCost),
  }));

  // الإجماليات (تُحسب في المجال؛ قد تفشل إن كانت البيانات ناقصة).
  let totals: { subtotal: { amount: number }; tax: { amount: number }; total: { amount: number } } | null = null;
  if (draftLines.length) {
    try {
      totals = calculateTotals(draftLines, currency, Number(taxRate) || 0);
    } catch {
      totals = null;
    }
  }

  const supplierValid = supplierId.length > 0;
  const linesValid = draftLines.length > 0 && draftLines.every((l) => l.quantity > 0 && l.unitCostAmount >= 0);
  const canSave = supplierValid && linesValid && !saving;

  // إنشاء الأمر.
  const handleCreate = async () => {
    if (!canSave) {
      toast.show(t('procurement.error.formInvalid'), 'danger');
      return;
    }
    setSaving(true);
    try {
      const po = await procurementRepository.createPurchaseOrder(
        {
          supplierId: asId(supplierId),
          lines: draftLines,
          currency,
          taxRate: Number(taxRate) || 0,
          notes: notes.trim() || undefined,
        },
        {
          tenantId: tenancy.context?.tenantId ?? asId('tenant-local'),
          organizationId: tenancy.context?.organizationId,
          branchId: tenancy.context?.branchId,
          storeId: tenancy.context?.storeId,
          userId: state.session?.user?.id,
        },
      );
      toast.show(t('procurement.orderCreated'), 'success');
      router.replace(`/(app)/po/${String(po.id)}` as never);
    } catch (error) {
      logger.error('PO create failed', { error: String(error) });
      toast.show(t('procurement.error.createFailed'), 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['top']} padded={false}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>{t('procurement.newOrderTitle')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* اختيار المورّد */}
        <Card glass style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('procurement.selectSupplier')}</Text>
          {suppliers.length === 0 ? (
            <EmptyState icon="business-outline" title={t('procurement.noSuppliersTitle')} description={t('procurement.noSuppliersDescription')} />
          ) : (
            <View style={styles.chipWrap}>
              {suppliers.map((s) => (
                <Chip
                  key={String(s.id)}
                  label={locale === 'ar' ? s.nameAr : s.nameEn}
                  icon="business-outline"
                  selected={supplierId === String(s.id)}
                  onPress={() => setSupplierId(String(s.id))}
                />
              ))}
            </View>
          )}
        </Card>

        {/* إضافة أصناف */}
        <Card glass style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('procurement.addItems')}</Text>
          <Input placeholder={t('procurement.searchProductsPh')} value={search} onChangeText={(v) => void onSearch(v)} leftIcon="search" />
          {results.map((p) => (
            <Pressable key={String(p.id)} onPress={() => addProduct(p)} style={[styles.resultRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={1}>{locale === 'ar' ? p.nameAr : p.nameEn}</Text>
              <Text style={[styles.resultPrice, { color: colors.primary }]}>{formatCurrency(p.price.amount, p.price.currency)}</Text>
              <Ionicons name="add-circle" size={20} color={colors.primary} />
            </Pressable>
          ))}
        </Card>

        {/* الأسطر المختارة */}
        {lines.map((line, index) => (
          <Card key={String(line.product.id)} glass style={styles.lineCard}>
            <View style={styles.lineHeader}>
              <Text style={[styles.lineName, { color: colors.text }]} numberOfLines={1}>{locale === 'ar' ? line.product.nameAr : line.product.nameEn}</Text>
              <Pressable onPress={() => removeLine(index)} accessibilityRole="button" accessibilityLabel={t('procurement.remove')}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
            <View style={styles.lineInputs}>
              <View style={styles.lineField}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t('procurement.qty')}</Text>
                <Input keyboardType="number-pad" value={line.quantity} onChangeText={(v) => updateLine(index, { quantity: v.replace(/[^0-9]/g, '') })} />
              </View>
              <View style={styles.lineField}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t('procurement.unitCost')}</Text>
                <Input keyboardType="numeric" value={line.unitCost} onChangeText={(v) => updateLine(index, { unitCost: v.replace(/[^0-9.]/g, '') })} />
              </View>
            </View>
          </Card>
        ))}

        {/* الضريبة والملاحظات */}
        <Card glass style={styles.section}>
          <View style={styles.taxRow}>
            <Text style={[styles.sectionTitle, { color: colors.text, flex: 1 }]}>{t('procurement.taxRate')}</Text>
            <View style={styles.taxInput}>
              <Input keyboardType="numeric" value={taxRate} onChangeText={(v) => setTaxRate(v.replace(/[^0-9.]/g, ''))} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>%</Text>
          </View>
          <Input label={t('procurement.notes')} placeholder={t('procurement.notesPh')} value={notes} onChangeText={setNotes} />
        </Card>

        {/* الإجماليات */}
        {totals ? (
          <Card glass style={styles.totalsCard}>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.textMuted }]}>{t('procurement.subtotal')}</Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>{formatCurrency(totals.subtotal.amount, currency)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.textMuted }]}>{t('procurement.tax')}</Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>{formatCurrency(totals.tax.amount, currency)}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.grandLabel, { color: colors.primary }]}>{t('procurement.total')}</Text>
              <Text style={[styles.grandValue, { color: colors.primary }]}>{formatCurrency(totals.total.amount, currency)}</Text>
            </View>
          </Card>
        ) : null}

        <Button label={t('procurement.createDraft')} icon="document-attach-outline" variant="success" loading={saving} disabled={!canSave} onPress={() => void handleCreate()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSize['2xl'], fontWeight: '800' },
  body: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing['6xl'] },
  section: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '800' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  resultName: { flex: 1, fontSize: fontSize.sm, fontWeight: '600' },
  resultPrice: { fontSize: fontSize.sm, fontWeight: '800' },
  lineCard: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  lineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  lineName: { flex: 1, fontSize: fontSize.md, fontWeight: '800' },
  lineInputs: { flexDirection: 'row', gap: spacing.md },
  lineField: { flex: 1 },
  fieldLabel: { fontSize: fontSize.xs, fontWeight: '700', marginBottom: 4 },
  taxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  taxInput: { width: 80 },
  totalsCard: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: fontSize.sm },
  totalValue: { fontSize: fontSize.sm, fontWeight: '800' },
  grandRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, marginTop: spacing.xs },
  grandLabel: { fontSize: fontSize.md, fontWeight: '900' },
  grandValue: { fontSize: fontSize.lg, fontWeight: '900' },
});
