import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricKind = 'faceId' | 'fingerprint' | 'iris' | null;

/** Returns the enrolled biometric type, or null if none is available. */
export async function getBiometricKind(): Promise<BiometricKind> {
  const [hasHardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  if (!hasHardware || !enrolled) return null;
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'faceId';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'fingerprint';
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'iris';
  return null;
}

export function biometricLabel(kind: BiometricKind): string {
  switch (kind) {
    case 'fingerprint':
      return 'fingerprint';
    case 'iris':
      return 'iris';
    default:
      return 'Face ID';
  }
}

/**
 * Explicit user-presence check before sensitive actions (revealing the recovery
 * phrase, signing). Falls back to the device passcode.
 */
export async function confirmUserPresence(reason: string): Promise<boolean> {
  // A device without any lock screen cannot prove presence; the wallet password
  // already gated this session, so allow rather than lock the user out.
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level === LocalAuthentication.SecurityLevel.NONE) return true;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    disableDeviceFallback: false,
  });
  return result.success;
}
