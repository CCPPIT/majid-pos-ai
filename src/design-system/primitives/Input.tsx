import { forwardRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
  type TextInputProps,
} from 'react-native';

import { useTheme } from '../theme';
import { fontSize, radius, spacing, touch } from '../tokens';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: string;
  rightSlot?: React.ReactNode;
  keyboardType?: KeyboardTypeOptions;
  returnKeyType?: ReturnKeyTypeOptions;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, leftIcon, rightSlot, accessibilityLabel, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.danger
    : focused
      ? colors.primary
      : colors.border;

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text style={[styles.label, { color: colors.textMuted }]} accessibilityRole="header">
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor,
            borderWidth: focused || error ? 1.5 : 1,
          },
        ]}
      >
        {leftIcon ? <Text style={[styles.leftIcon, { color: colors.textSubtle }]}>{leftIcon}</Text> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textSubtle}
          accessibilityLabel={accessibilityLabel ?? label}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[styles.input, { color: colors.text }]}
        />
        {rightSlot}
      </View>
      {error ? (
        <Text style={[styles.feedback, { color: colors.danger }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.feedback, { color: colors.textSubtle }]}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, fontWeight: '600' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    minHeight: touch.minTargetLarge,
    gap: spacing.sm,
  },
  leftIcon: { fontSize: fontSize.base },
  input: {
    flex: 1,
    fontSize: fontSize.base,
    paddingVertical: spacing.md,
    minHeight: touch.minTarget,
  },
  feedback: { fontSize: fontSize.xs, paddingHorizontal: spacing.xs },
});
