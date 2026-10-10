import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientProviderProps } from '@tanstack/react-query-persist-client';

export const queryClient = new QueryClient();

// Pause refetch intervals while the app is in the background (React Native has no window focus).
if (Platform.OS !== 'web') {
  focusManager.setEventListener((handleFocus) => {
    const sub = AppState.addEventListener('change', (state) => handleFocus(state === 'active'));
    return () => sub.remove();
  });
}

/** Query keys that may be saved to disk: market prices only, never wallet data. */
const PERSISTED_KEYS = new Set(['quotes', 'priceHistory']);

/**
 * Keeps the last known prices on disk so the app opens instantly; screens mark
 * them with their age (see PriceStatus) until a fresh fetch succeeds.
 */
export const persistOptions: PersistQueryClientProviderProps['persistOptions'] = {
  persister: createAsyncStoragePersister({ storage: AsyncStorage, key: 'sqw.prices' }),
  maxAge: 24 * 60 * 60 * 1000,
  buster: 'prices-v2',
  dehydrateOptions: {
    shouldDehydrateQuery: (q) => q.state.status === 'success' && PERSISTED_KEYS.has(String(q.queryKey[0])),
  },
};
