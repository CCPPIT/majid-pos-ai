/**
 * Toast system — non-blocking feedback rendered at the root.
 * Mount <ToastProvider/> once inside the theme provider; call `useToast()`
 * (or the exported `toast` singleton) from anywhere — no prop drilling.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { fontSize, radius, spacing } from '../tokens';
import type { Tone } from '../tokens/colors';
import { toneColors } from '../tokens/colors';

type ToastTone = Extract<Tone, 'success' | 'warning' | 'danger' | 'info'>;

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  show: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TOAST_ICON: Record<ToastTone, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  warning: 'warning',
  danger: 'alert-circle',
  info: 'information-circle',
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = nextId++;
      setToasts((list) => [...list.slice(-2), { id, message, tone }]);
      const timer = setTimeout(() => dismiss(id), 3200);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m) => show(m, 'success'),
      error: (m) => show(m, 'danger'),
      info: (m) => show(m, 'info'),
    }),
    [show],
  );

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <SafeAreaView
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        edges={['top']}
      >
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingTop: spacing.sm }}>
          {toasts.map((t) => {
            const { strong } = toneColors(colors, t.tone);
            return (
              <Animated.View
                key={t.id}
                entering={FadeInUp.duration(220)}
                exiting={FadeOutDown.duration(180)}
                accessibilityRole="alert"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  backgroundColor: colors.surfaceElevated,
                  borderColor: strong,
                  borderWidth: 1,
                  borderRadius: radius.lg,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.lg,
                  shadowColor: colors.shadow,
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 8,
                }}
              >
                <Ionicons name={TOAST_ICON[t.tone]} size={20} color={strong} />
                <Text style={{ flex: 1, color: colors.text, fontSize: fontSize.sm, fontWeight: '600' }}>
                  {t.message}
                </Text>
              </Animated.View>
            );
          })}
        </View>
      </SafeAreaView>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
