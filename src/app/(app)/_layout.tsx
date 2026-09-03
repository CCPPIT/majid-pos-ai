import { Redirect, Stack } from 'expo-router';

import { useBootstrap } from '@/features/bootstrap/bootstrap-context';
import { useTheme } from '@/design-system';

export default function AppGroupLayout() {
  const { ready, state } = useBootstrap();
  const { colors } = useTheme();

  if (!ready) return null;
  if (!state.session) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
