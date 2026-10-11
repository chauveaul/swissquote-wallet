import { useEffect, useRef } from 'react';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FocusedKeyboardToolbar } from '@/components/FocusedKeyboardToolbar';
import { ToastHost } from '@/components/Toast';
import { useActivityConfirmations } from '@/features/market/queries';
import { useWallet } from '@/features/wallet/store';
import { useAutoLock } from '@/features/wallet/useAutoLock';
import { closeKeyboard } from '@/lib/keyboard';
import { persistOptions, queryClient } from '@/lib/queryClient';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const KEYBOARD_TOOLBAR_THEME = {
  light: { primary: colors.ink, disabled: colors.borderInput, background: colors.surfaceMuted, ripple: colors.border },
  dark: { primary: colors.surface, disabled: colors.textMuted, background: colors.dark.field, ripple: colors.dark.border },
};

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
  // Keeps polling for pending sends (incl. Swissquote deposit confirmation)
  // regardless of which screen is open — see the hook's own comment.
  useActivityConfirmations();

  useEffect(() => {
    hydrate().catch((e) => {
      console.error('[wallet] failed to load vault', e);
      useWallet.setState({ status: 'empty' });
    });
  }, [hydrate]);

  // When a wallet is created or imported, start on Home. Otherwise the router
  // would restore the last route it remembers (e.g. Sign out from the previous
  // wallet) as soon as the guards allow it again.
  const walletGeneration = useWallet((s) => s.walletGeneration);
  const seenGeneration = useRef(walletGeneration);
  useEffect(() => {
    if (walletGeneration === seenGeneration.current) return;
    seenGeneration.current = walletGeneration;
    router.replace('/');
  }, [walletGeneration]);

  // Fallback for every other screen change (e.g. Send → Review): the outgoing
  // screen is still mounted while it animates away, so closing the keyboard now
  // hides it cleanly instead of leaving the toolbar stuck on Android.
  const pathname = usePathname();
  useEffect(() => {
    closeKeyboard().catch(() => undefined);
  }, [pathname]);

  const ready = (fontsLoaded || fontError) && status !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.surface },
            }}
          >
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
          {/* Previous / next / Done above every keyboard, so number pads (which
              have no return key) can always be closed. */}
          <FocusedKeyboardToolbar theme={KEYBOARD_TOOLBAR_THEME} doneText="Done" />
          <ToastHost />
        </PersistQueryClientProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
