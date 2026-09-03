import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { ThemeProvider, useTheme } from '@/design-system/theme/ThemeProvider';

function ThemeProbe() {
  const { colors, mode, isDark, spacing: sp, textVariants, shadow: getShadow } = useTheme();
  return (
    <Text
      testID="probe"
      data-mode={mode}
      data-dark={String(isDark)}
      data-bg={colors.background}
      data-spacing={sp.lg}
      data-variant={textVariants.heading.fontSize}
      data-shadow={getShadow('sm').elevation}
    >
      theme
    </Text>
  );
}

describe('ThemeProvider', () => {
  it('provides the dark palette in the jest environment', () => {
    let renderer: ReturnType<typeof create> | undefined;
    act(() => {
      renderer = create(
        <ThemeProvider>
          <ThemeProbe />
        </ThemeProvider>,
      );
    });

    const text = renderer!.root.findByType(Text);
    expect(text.props['data-mode']).toBe('dark');
    expect(text.props['data-dark']).toBe('true');
    expect(text.props['data-bg']).toBe('#0B0F14');
    expect(text.props['data-spacing']).toBe(16);
    expect(text.props['data-variant']).toBe(20);
    expect(text.props['data-shadow']).toBeGreaterThan(0);
  });
});
