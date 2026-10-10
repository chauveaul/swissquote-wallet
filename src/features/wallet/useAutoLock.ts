import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';

import { useWallet } from './store';

/**
 * Locks the wallet after it has spent the user's auto-lock delay (Settings →
 * Biometrics & auto-lock) in the background, and
 * blurs the iOS app-switcher snapshot while unlocked so balances and phrases
 * don't leak into the task switcher.
 */
export function useAutoLock() {
  const status = useWallet((s) => s.status);
  const lock = useWallet((s) => s.lock);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (status === 'unlocked') {
      ScreenCapture.enableAppSwitcherProtectionAsync(0.8).catch(() => undefined);
      return () => {
        ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => undefined);
      };
    }
  }, [status]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        backgroundedAt.current = Date.now();
      } else if (next === 'active' && backgroundedAt.current !== null) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        const delay = useWallet.getState().meta?.autoLockMs ?? 60_000;
        if (away >= delay && useWallet.getState().status === 'unlocked') lock();
      }
    });
    return () => sub.remove();
  }, [lock]);
}
