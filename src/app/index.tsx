/**
 * Bootstrap Guard — the single routing decision point (Section 17).
 *   Launch → loading → onboarding? → sign-in? → store setup? → main app
 */
import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { useBootstrap } from '@/features/bootstrap/bootstrap-context';
import { decideBootstrapRoute } from '@/features/bootstrap/use-bootstrap';
import { Spinner, useTheme } from '@/design-system';

export default function BootstrapGuard() {
  const { ready, state } = useBootstrap();
  const { colors } = useTheme();

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="large" />
      </View>
    );
  }

  const route = decideBootstrapRoute(state);
  if (route === 'loading') return null;

  return <Redirect href={route} />;
}
