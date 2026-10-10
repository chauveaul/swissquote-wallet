import * as LocalAuthentication from 'expo-local-authentication';

/** True when the device has biometric hardware with at least one enrolment (face, fingerprint or iris). */
export async function isBiometricsAvailable(): Promise<boolean> {
  const [hasHardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && enrolled;
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
