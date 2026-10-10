import { useEffect } from 'react';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useWallet } from '@/features/wallet/store';
import { useAutoLock } from '@/features/wallet/useAutoLock';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    IBMPlexMono_500Medium,
  });
  const status = useWallet((s) => s.status);
  const hydrate = useWallet((s) => s.hydrate);

  useAutoLock();

  useEffect(() => {
    hydrate().catch((e) => {
      console.error('[wallet] failed to load vault', e);
      useWallet.setState({ status: 'empty' });
    });
  }, [hydrate]);

  const ready = (fontsLoaded || fontError) && status !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
          {/* First run: create or import. */}
          <Stack.Protected guard={status === 'empty'}>
            <Stack.Screen name="welcome" />
            <Stack.Screen name="create-phrase" />
          </Stack.Protected>

          {/* Wallet exists but session is locked. */}
          <Stack.Protected guard={status === 'locked'}>
            <Stack.Screen name="unlock" options={{ animation: 'fade' }} />
          </Stack.Protected>

          {/* Restore is reachable from Welcome and from "Forgot password". */}
          <Stack.Protected guard={status !== 'unlocked'}>
            <Stack.Screen name="restore" />
            <Stack.Screen name="set-password" />
          </Stack.Protected>

          <Stack.Protected guard={status === 'unlocked'}>
            <Stack.Screen name="(wallet)" options={{ animation: 'fade' }} />
          </Stack.Protected>
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
