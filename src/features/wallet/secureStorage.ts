import * as SecureStore from 'expo-secure-store';

/**
 * Thin wrapper over the iOS Keychain / Android Keystore (expo-secure-store).
 * Items are bound to this device: excluded from backups and never migrated.
 */

const BASE: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const secureStorage = {
  get: (key: string) => SecureStore.getItemAsync(key, BASE),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value, BASE),
  remove: (key: string) => SecureStore.deleteItemAsync(key, BASE),

  /**
   * Stores a value that can only be read after a successful biometric check.
   * Requires a device passcode; the item is invalidated if biometrics change.
   */
  setProtected: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value, {
      requireAuthentication: true,
      keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    }),
  getProtected: (key: string, prompt: string) =>
    SecureStore.getItemAsync(key, {
      requireAuthentication: true,
      authenticationPrompt: prompt,
      keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    }),
  removeProtected: (key: string) =>
    SecureStore.deleteItemAsync(key, {
      requireAuthentication: true,
      keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    }),
};
