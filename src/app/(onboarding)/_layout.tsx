import { Redirect, Stack } from 'expo-router';

import { useBootstrap } from '@/features/bootstrap/bootstrap-context';
import { useTheme } from '@/design-system';

export default function OnboardingLayout() {
  const { ready, state } = useBootstrap();
  const { colors } = useTheme();

  if (ready && state.onboardingCompleted) {
    return <Redirect href={state.session ? '/(app)/(tabs)' : '/(auth)/sign-in'} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
