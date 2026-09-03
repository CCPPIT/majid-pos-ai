import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useTheme } from '../theme';
import { fontSize, radius, spacing, touch } from '../tokens';
import { useTranslation } from '@/i18n/LocaleProvider';

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  accessibilityLabel?: string;
}

export function SearchInput({
  value,
  onChangeText,
  placeholder,
  onSubmit,
  accessibilityLabel,
}: SearchInputProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const placeholderText = placeholder ?? t('common.search');

  return (
    <View
      style={[
        styles.field,
        { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
      ]}
    >
      <Ionicons name="search" size={20} color={colors.textSubtle} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholderText}
        placeholderTextColor={colors.textSubtle}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        accessibilityLabel={accessibilityLabel ?? placeholderText}
        style={[styles.input, { color: colors.text }]}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.clearSearch')}
          onPress={() => onChangeText('')}
          hitSlop={10}
        >
          <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    minHeight: touch.minTargetLarge,
  },
  input: { flex: 1, fontSize: fontSize.base, minHeight: touch.minTarget, paddingVertical: 0 },
});
