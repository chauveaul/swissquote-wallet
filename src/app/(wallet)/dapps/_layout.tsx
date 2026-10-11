import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

export default function DappsLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />;
}
