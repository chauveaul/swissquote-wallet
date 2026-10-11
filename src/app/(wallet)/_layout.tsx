import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

export default function WalletLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="accounts" options={{ presentation: 'modal' }} />
      {/* Always opened from inside the Accounts modal — pushed on top of it, not
          presented as its own modal (stacking two native modals is unreliable). */}
      <Stack.Screen name="account-name" />
      <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
    </Stack>
  );
}
