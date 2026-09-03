/**
 * Manual jest mock for react-native-reanimated (v4 + worklets native runtime
 * is unavailable under Node). Animations are identity/no-op; Animated.*
 * components render their plain RN counterparts.
 *
 * Exports both the default and named namespaces identically (the default
 * export references the same object as the named `Animated` export).
 */
import * as React from 'react';
import { View, Text, ScrollView, Image, FlatList, Pressable } from 'react-native';

const identity = <T,>(v: T): T => v;

export const useSharedValue = (initial: unknown) => ({ value: initial });
export const useAnimatedStyle = (fn: () => unknown) => (typeof fn === 'function' ? fn() : {});
export const useAnimatedProps = (fn: () => unknown) => (typeof fn === 'function' ? fn() : {});
export const useDerivedValue = (fn: () => unknown) => ({
  value: typeof fn === 'function' ? fn() : fn,
});
export const withTiming = identity;
export const withSpring = identity;
export const withRepeat = identity;
export const withSequence = (...args: unknown[]) => args[0];
export const withDelay = (_d: unknown, a: unknown) => a;
export const runOnJS = <T,>(fn: T): T => fn;
export const runOnUI = <T,>(fn: T): T => fn;

// Scroll handler: return a plain event handler that invokes onScroll.
export const useAnimatedScrollHandler = (
  handlers: { onScroll?: (e: { contentOffset: { x: number; y: number } }) => void } | ((e: unknown) => void),
) => (event: { nativeEvent: { contentOffset: { x: number; y: number } } }) => {
  const payload = { contentOffset: event.nativeEvent.contentOffset };
  if (typeof handlers === 'function') handlers(payload);
  else handlers.onScroll?.(payload);
};

export const Extrapolation = {
  EXTEND: 'extend',
  CLAMP: 'clamp',
  IDENTITY: 'identity',
} as const;

/** Piecewise-linear interpolation (test-grade; identical semantics for the
 * ranges the UI uses). Clamps outside the input range. */
export const interpolate = (
  value: number,
  input: number[],
  output: number[],
  options?: { extrapolateLeft?: string; extrapolateRight?: string },
): number => {
  if (input.length === 0) return output[0] ?? 0;
  if (value <= input[0]!) return output[0]!;
  if (value >= input[input.length - 1]!) return output[output.length - 1]!;
  for (let i = 1; i < input.length; i += 1) {
    if (value <= input[i]!) {
      const x0 = input[i - 1]!;
      const x1 = input[i]!;
      const y0 = output[i - 1]!;
      const y1 = output[i]!;
      const t = x1 === x0 ? 0 : (value - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t;
    }
  }
  return output[output.length - 1]!;
};

const anim = () => ({ duration: () => ({}), delay: () => ({}), springify: () => ({}) });
export const FadeIn = anim;
export const FadeInUp = anim;
export const FadeInDown = anim;
export const FadeOut = anim;
export const FadeOutUp = anim;
export const FadeOutDown = anim;
export const SlideInDown = anim;
export const Layout = anim;

const createAnimatedComponent = <P extends Record<string, unknown>>(
  component: React.ComponentType<P>,
): React.FC<P> => {
  const Wrapped: React.FC<P> = (props) => React.createElement(component, props);
  Wrapped.displayName = 'AnimatedMockComponent';
  return Wrapped;
};

export const Animated = {
  View: createAnimatedComponent(View as unknown as React.ComponentType<Record<string, unknown>>),
  Text: createAnimatedComponent(Text as unknown as React.ComponentType<Record<string, unknown>>),
  ScrollView: createAnimatedComponent(ScrollView as unknown as React.ComponentType<Record<string, unknown>>),
  Image: createAnimatedComponent(Image as unknown as React.ComponentType<Record<string, unknown>>),
  FlatList: createAnimatedComponent(FlatList as unknown as React.ComponentType<Record<string, unknown>>),
  Pressable: createAnimatedComponent(Pressable as unknown as React.ComponentType<Record<string, unknown>>),
  createAnimatedComponent,
};

const Reanimated = {
  ...Animated,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  useDerivedValue,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  runOnJS,
  runOnUI,
  FadeIn,
  FadeInUp,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  FadeOutDown,
  SlideInDown,
  Layout,
  Animated,
  createAnimatedComponent,
};

export default Reanimated;
