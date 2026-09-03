import { Redirect, Stack } from 'expo-router';

import { useBootstrap } from '@/features/bootstrap/bootstrap-context';
import { useTheme } from '@/design-system';

export default function AuthLayout() {
  const { ready, state } = useBootstrap();
  const { colors } = useTheme();

  if (ready && state.session) {
    return (
      <Redirect href={state.storeSetupCompleted ? '/(app)/(tabs)' : '/(app)/store-setup'} />
    );
  }

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
