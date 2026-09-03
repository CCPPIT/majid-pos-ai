/**
 * شبكة عناصر لوحة التحكم (PHASE 10).
 * تعرض العناصر المفلترة بالصلاحية: البطاقات الكبيرة بعرض كامل،
 * والبطاقات المتوسطة/الصغيرة في صفوف من عمودين. كل بطاقة قابلة للضغط
 * (تنقّل أو لافتة) وتعرض قيمة المؤشر مع اتجاه التغير.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/design-system';
import { fontSize, radius, spacing } from '@/design-system/tokens';
import { toneColors } from '@/design-system/tokens/colors';
import { Card } from '@/design-system/primitives/Card';
import { useToast } from '@/design-system/primitives/Toast';
import { useTranslation } from '@/i18n/LocaleProvider';
import type { MetricTone, MetricValue, MetricTrend } from '@/domain/dashboard/types';
import type { WidgetDefinition } from '@/domain/security/dashboard-widgets';
import { getWidgetAction } from './widget-actions';

// خصائص الشبكة.
interface DashboardGridProps {
  widgets: WidgetDefinition[]; // العناصر المرئية.
  metrics: Record<string, MetricValue>; // المؤشرات بالمعرف.
  currency: string; // عملة تنسيق المبالغ.
}

// نطّق نغمة المجال إلى نغمة نظام التصميم (مطابقة الأسماء).
function toDesignTone(tone: MetricTone | undefined): 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  return tone ?? 'primary';
}

// سهم/لون اتجاه التغير.
function TrendIndicator({ trend, deltaPercent, t }: { trend?: MetricTrend; deltaPercent?: number; t: (k: string, p?: Record<string, string | number>) => string }) {
  const { colors } = useTheme();
  // ثابت = بلا سهم.
  if (!trend || trend === 'flat' || deltaPercent === undefined) return null;
  const up = trend === 'up';
  const color = up ? colors.success : colors.danger; // أخضر صعودًا / أحمر هبوطًا.
  const icon = up ? 'arrow-up-outline' : 'arrow-down-outline';
  return (
    <View style={styles.trend} accessibilityLabel={up ? t('dashboard.trendUp') : t('dashboard.trendDown')}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={14} color={color} />
      <Text style={[styles.trendText, { color }]}>{t('dashboard.percentValue', { value: Math.abs(deltaPercent).toFixed(1) })}</Text>
    </View>
  );
}

// بطاقة عنصر واحدة.
function WidgetCard({
  widget,
  metric,
  isLarge,
  currency,
  onPress,
}: {
  widget: WidgetDefinition; // تعريف العنصر.
  metric: MetricValue | undefined; // قيمته (قد تنعدم لبطاقة إجراء).
  isLarge: boolean; // بطاقة كبيرة (عرض كامل)؟
  currency: string; // العملة.
  onPress: () => void; // عند الضغط.
}) {
  const { colors } = useTheme();
  const { t, formatCurrency, formatNumber } = useTranslation();
  const tone = toDesignTone(metric?.tone);
  const palette = toneColors(colors, tone);

  // تنسيق القيمة الرئيسية حسب نوعها.
  const mainValue = metric?.amount !== undefined
    ? formatCurrency(metric.amount, currency, { compact: true }) // مالية مختصرة.
    : metric?.count !== undefined
      ? formatNumber(metric.count) // عدد.
      : metric?.textKey
        ? t(metric.textKey) // نص حر.
        : '';

  // بطاقة "بيع جديد": إجراء بارز بعرض كامل.
  const isAction = widget.id === 'new-sale';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(widget.titleKey)}
      accessibilityHint={t('dashboard.openWidget')}
      onPress={onPress}
      style={({ pressed }) => [isLarge ? styles.cellLarge : styles.cellHalf, pressed && styles.pressed]}
    >
      <Card
        glass
        elevation="sm"
        style={[
          styles.card,
          isLarge && styles.cardLarge,
          isAction && { backgroundColor: colors.primarySoft, borderColor: palette.strong },
        ]}
      >
        <View style={styles.cardTop}>
          <View style={[styles.iconBadge, { backgroundColor: palette.soft }]}>
            <Ionicons name={widget.icon as keyof typeof Ionicons.glyphMap} size={isLarge ? 24 : 20} color={palette.strong} />
          </View>
          {isAction ? (
            <Ionicons name="add" size={22} color={palette.strong} />
          ) : (
            <TrendIndicator trend={metric?.trend} deltaPercent={metric?.deltaPercent} t={t} />
          )}
        </View>

        <Text style={[styles.title, { color: colors.textMuted }]} numberOfLines={1}>
          {t(widget.titleKey)}
        </Text>

        {isAction ? (
          <Text style={[styles.actionValue, { color: palette.strong }]}>{t('dashboard.startSelling')}</Text>
        ) : (
          <Text
            style={[
              styles.value,
              isLarge && styles.valueLarge,
              { color: colors.text },
              metric?.textKey ? styles.valueText : null,
            ]}
            numberOfLines={metric?.textKey ? 3 : 1}
          >
            {mainValue}
          </Text>
        )}

        {metric?.sublabelKey ? (
          <Text style={[styles.sublabel, { color: colors.textSubtle }]} numberOfLines={1}>
            {t(metric.sublabelKey)}
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}

export function DashboardGrid({ widgets, metrics, currency }: DashboardGridProps) {
  const router = useRouter(); // التنقل.
  const toast = useToast(); // لافتات العناصر غير المنفذة.
  const { t } = useTranslation();

  // معالجة الضغط: تنقّل أو لافتة صادقة بالمرحلة.
  const handlePress = (widget: WidgetDefinition) => {
    const action = getWidgetAction(widget.id);
    if (action.kind === 'placeholder') {
      // ميزة قادمة — لا سلوك وهمي، لافتة صادقة بالمرحلة.
      toast.show(t('dashboard.comingSoon', { feature: t(action.phaseLabelKey ?? 'dashboard.phaseComing') }), 'info');
      return;
    }
    if (action.href) router.push(action.href); // انتقال للمسار.
  };

  // نبني صفوفًا: كبيرة بمفردها، والبقية أزواج (متوسط/صغير).
  const rows: React.ReactNode[] = [];
  let pair: WidgetDefinition[] = [];
  for (const widget of widgets) {
    if (widget.size === 'large') {
      if (pair.length > 0) {
        // نُفرّغ أي زوج معلّق أولًا.
        rows.push(
          <View key={`pair-${rows.length}`} style={styles.row}>
            {pair.map((w) => (
              <WidgetCard key={w.id} widget={w} metric={metrics[w.id]} isLarge={false} currency={currency} onPress={() => handlePress(w)} />
            ))}
          </View>,
        );
        pair = [];
      }
      rows.push(
        <View key={`large-${widget.id}`} style={styles.row}>
          <WidgetCard widget={widget} metric={metrics[widget.id]} isLarge currency={currency} onPress={() => handlePress(widget)} />
        </View>,
      );
    } else {
      pair.push(widget);
      if (pair.length === 2) {
        const current = pair;
        rows.push(
          <View key={`pair-${rows.length}`} style={styles.row}>
            {current.map((w) => (
              <WidgetCard key={w.id} widget={w} metric={metrics[w.id]} isLarge={false} currency={currency} onPress={() => handlePress(w)} />
            ))}
          </View>,
        );
        pair = [];
      }
    }
  }
  // زوج أخير غير مكتمل (بطاقة يتيمة).
  if (pair.length > 0) {
    rows.push(
      <View key={`pair-last`} style={styles.row}>
        {pair.map((w) => (
          <WidgetCard key={w.id} widget={w} metric={metrics[w.id]} isLarge={false} currency={currency} onPress={() => handlePress(w)} />
        ))}
      </View>,
    );
  }

  return <View style={styles.grid}>{rows}</View>;
}

// أنماط الشبكة والبطاقات.
const styles = StyleSheet.create({
  grid: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  cellHalf: { flex: 1 },
  cellLarge: { flex: 1 },
  pressed: { opacity: 0.85 },
  card: { padding: spacing.lg, gap: spacing.xs, minHeight: 132 },
  cardLarge: { minHeight: 148 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconBadge: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  trendText: { fontSize: fontSize.xs, fontWeight: '700' },
  title: { fontSize: fontSize.sm, fontWeight: '600', marginTop: spacing.xs },
  value: { fontSize: fontSize.xl, fontWeight: '800' },
  valueLarge: { fontSize: fontSize['2xl'] },
  valueText: { fontSize: fontSize.sm, fontWeight: '600', lineHeight: 20 },
  actionValue: { fontSize: fontSize.lg, fontWeight: '800' },
  sublabel: { fontSize: fontSize.xs },
});
