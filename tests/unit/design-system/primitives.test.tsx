import type { ReactElement } from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ThemeProvider } from '@/design-system/theme/ThemeProvider';
import { Button } from '@/design-system/primitives/Button';
import { Badge } from '@/design-system/primitives/Badge';
import { Chip } from '@/design-system/primitives/Chip';
import { EmptyState } from '@/design-system/primitives/EmptyState';
import { Progress } from '@/design-system/primitives/Progress';

const render = (element: ReactElement): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(<ThemeProvider>{element}</ThemeProvider>);
  });
  return renderer!;
};

describe('primitives', () => {
  it('Button renders label and fires onPress', () => {
    const onPress = jest.fn();
    const renderer = render(<Button label="ادفع" onPress={onPress} />);
    const pressable = renderer.root.findByProps({ accessibilityRole: 'button' });
    expect(pressable.props.accessibilityLabel).toBe('ادفع');

    act(() => {
      pressable.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('Button exposes disabled state to accessibility and disables interaction', () => {
    const onPress = jest.fn();
    const renderer = render(<Button label="x" onPress={onPress} disabled />);
    const pressable = renderer.root.findByProps({ accessibilityRole: 'button' });
    expect(pressable.props.accessibilityState).toMatchObject({ disabled: true });
    // The native Pressable receives disabled=true, which blocks presses.
    expect(pressable.props.disabled).toBe(true);
  });

  it('Badge renders its label', () => {
    const renderer = render(<Badge label="مخزون منخفض" tone="warning" />);
    const text = renderer.root.findByType(Text);
    expect(text.props.children).toContain('مخزون منخفض');
  });

  it('Chip reports selected state', () => {
    const renderer = render(<Chip label="الكل" selected onPress={() => undefined} />);
    const pressable = renderer.root.findByProps({ accessibilityRole: 'button' });
    expect(pressable.props.accessibilityState).toMatchObject({ selected: true });
  });

  it('EmptyState renders title and fires action', () => {
    const onAction = jest.fn();
    const renderer = render(
      <EmptyState title="لا منتجات" description="أضف منتجًا" actionLabel="أضف" onAction={onAction} />,
    );
    act(() => {
      renderer.root.findByProps({ accessibilityLabel: 'أضف' }).props.onPress();
    });
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('Progress clamps values and exposes accessibility percentage', () => {
    const over = render(<Progress value={1.7} />);
    expect(over.root.findByProps({ accessibilityRole: 'progressbar' }).props.accessibilityValue.now).toBe(100);

    const under = render(<Progress value={-0.5} />);
    expect(under.root.findByProps({ accessibilityRole: 'progressbar' }).props.accessibilityValue.now).toBe(0);
  });
});
