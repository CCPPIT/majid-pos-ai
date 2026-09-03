/**
 * مبدّل المتجر (Store Switcher) — يعرض المتاجر المتاحة للمستخدم
 * ويبدّل السياق النشط عبر سياق المستأجر. يدعم نطاق الدور (من لا يملك
 * أكثر من متجر لا يرى زر تبديل فعليًا).
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { BottomSheet, useTheme } from '@/design-system';
import { useTranslation } from '@/i18n/LocaleProvider';
import type { ID } from '@/core/types/domain';
import { useTenancy } from './tenancy-context';

interface StoreSwitcherProps {
  visible: boolean; // هل الورقة مفتوحة؟
  onClose: () => void; // إغلاق الورقة.
}

export function StoreSwitcher({ visible, onClose }: StoreSwitcherProps) {
  const { colors, spacing } = useTheme(); // الألوان والمسافات.
  const { context, accessibleStores, switchStore, canSwitchStore } = useTenancy(); // السياق.
  const { t } = useTranslation(); // الترجمة.

  // هل المتجر هو النشط حاليًا؟
  const isActive = (id: ID) => context?.storeId === id;

  // اختيار متجر جديد.
  const handleSelect = async (id: ID) => {
    if (!canSwitchStore) {
      onClose(); // لا تبديل لهذا الدور؛ نغلق فقط.
      return;
    }
    await switchStore(id); // نبدّل ونحفظ.
    onClose(); // نغلق الورقة.
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('tenancy.selectStore')}>
      {/* اسم الفرع/المتجر الحالي كرأس معلوماتي. */}
      <View style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
          {t('tenancy.selectStore')}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>
          {context?.branchName} · {context?.tenantName}
        </Text>
      </View>

      {/* قائمة المتاجر. */}
      <View style={{ gap: spacing.sm }}>
        {accessibleStores.map(({ store, branchName }) => {
          const active = isActive(store.id); // هل هذا المتجر مختار؟
          return (
            <Pressable
              key={String(store.id)}
              accessibilityRole="button"
              accessibilityLabel={`${store.name} - ${branchName}`}
              accessibilityState={{ selected: active }}
              onPress={() => void handleSelect(store.id)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.lg,
                paddingHorizontal: spacing.lg,
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primarySoft : colors.surfaceMuted,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons
                name={active ? 'storefront' : 'storefront-outline'}
                size={22}
                color={active ? colors.primary : colors.textSubtle}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{store.name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {branchName} · {store.code}
                </Text>
              </View>
              {active ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}
