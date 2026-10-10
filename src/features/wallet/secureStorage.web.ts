/**
 * Web has no hardware-backed keystore. This store exists only so the UI can
 * be previewed in a browser during development; the wallet is not supported
 * on web for real funds. Backed by localStorage (survives reloads) when
 * available, falling back to in-memory.
 */
const PREFIX = 'sqw.web.';
const memory = new Map<string, string>();
const local: Storage | null =
  typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;

if (__DEV__) {
  console.warn('[wallet] Using browser storage on web — development preview only.');
}

export const secureStorage = {
  get: async (key: string) => (local ? local.getItem(PREFIX + key) : memory.get(key)) ?? null,
  set: async (key: string, value: string) => {
    if (local) local.setItem(PREFIX + key, value);
    else memory.set(key, value);
  },
  remove: async (key: string) => {
    if (local) local.removeItem(PREFIX + key);
    else memory.delete(key);
  },
  setProtected: (key: string, value: string) => secureStorage.set(key, value),
  getProtected: (key: string, _prompt: string) => secureStorage.get(key),
  removeProtected: (key: string) => secureStorage.remove(key),
};
