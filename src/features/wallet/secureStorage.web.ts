/**
 * Web has no hardware-backed keystore. This in-memory store exists only so the
 * UI can be previewed in a browser during development; nothing survives a
 * reload. The wallet is not supported on web for real funds.
 */
const memory = new Map<string, string>();

if (__DEV__) {
  console.warn('[wallet] Using in-memory secure storage on web — development preview only.');
}

export const secureStorage = {
  get: async (key: string) => memory.get(key) ?? null,
  set: async (key: string, value: string) => void memory.set(key, value),
  remove: async (key: string) => void memory.delete(key),
  setProtected: async (key: string, value: string) => void memory.set(key, value),
  getProtected: async (key: string, _prompt: string) => memory.get(key) ?? null,
  removeProtected: async (key: string) => void memory.delete(key),
};
