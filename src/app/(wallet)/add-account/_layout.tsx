import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

/** Onboarding for an extra account, inside an unlocked wallet (no password step). */
export default function AddAccountLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />;
}
