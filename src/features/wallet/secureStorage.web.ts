/**
 * Web has no hardware-backed keystore. This persists to localStorage so a
 * wallet survives a reload/tab close during development — it is NOT
 * encrypted at this layer (only the vault blob's own AES-GCM is) and nothing
 * here is biometric-gated. The wallet is not supported on web for real funds.
 */
const PREFIX = 'sqw-dev.';

function read(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    // Private browsing / storage disabled: falls back to losing state on reload.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

if (__DEV__) {
  console.warn('[wallet] Using localStorage for secure storage on web — development preview only, not encrypted at rest.');
}

export const secureStorage = {
  get: async (key: string) => read(key),
  set: async (key: string, value: string) => write(key, value),
  remove: async (key: string) => remove(key),
  setProtected: async (key: string, value: string) => write(key, value),
  getProtected: async (key: string, _prompt: string) => read(key),
  removeProtected: async (key: string) => remove(key),
};
