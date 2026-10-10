import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

export default function WalletLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="accounts" options={{ presentation: 'modal' }} />
      <Stack.Screen name="account-name" options={{ presentation: 'modal' }} />
      <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
    </Stack>
  );
}
