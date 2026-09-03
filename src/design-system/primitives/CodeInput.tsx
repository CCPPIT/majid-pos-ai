/**
 * Digit code input — 4 boxes for OTP / PIN entry (Section 50 accessible).
 * A single hidden TextInput drives digit boxes; the screen receives each
 * change and decides validation/navigation.
 */
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../theme';
import { fontSize, radius, spacing } from '../tokens';

interface CodeInputProps {
  length?: number;
  value: string;
  onChangeText: (value: string) => void;
  onComplete?: (value: string) => void;
  secure?: boolean;
  error?: boolean;
  autoFocus?: boolean;
  accessibilityLabel: string;
}

export function CodeInput({
  length = 4,
  value,
  onChangeText,
  onComplete,
  secure = false,
  error = false,
  autoFocus = true,
  accessibilityLabel,
}: CodeInputProps) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, length);
    onChangeText(digits);
    if (digits.length === length) onComplete?.(digits);
  };

  return (
    <Pressable
      accessibilityRole="none"
      onPress={() => inputRef.current?.focus()}
      style={styles.row}
    >
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        secureTextEntry={secure}
        caretHidden
        style={styles.hiddenInput}
        accessibilityLabel={accessibilityLabel}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        textContentType={secure ? 'password' : 'oneTimeCode'}
      />
      {Array.from({ length }).map((_, i) => {
        const filled = i < value.length;
        const active = focused && i === value.length;
        const borderColor = error
          ? colors.danger
          : active || filled
            ? colors.primary
            : colors.borderStrong;
        return (
          <View
            key={i}
            style={[
              styles.box,
              {
                borderColor,
                backgroundColor: colors.surfaceMuted,
              },
            ]}
            accessibilityRole="text"
          >
            <Text
              style={{
                color: colors.text,
                fontSize: fontSize.xl,
                fontWeight: '800',
              }}
            >
              {filled ? (secure ? '●' : value[i]) : ''}
            </Text>
          </View>
        );
      })}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  box: {
    width: 62,
    height: 68,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
