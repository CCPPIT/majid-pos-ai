/**
 * Biometric service (Section 47) — availability and prompt over
 * expo-local-authentication. Kept out of UI so screens just call the service.
 */
import * as LocalAuthentication from 'expo-local-authentication';

export interface BiometricCapability {
  available: boolean;
  enrolled: boolean;
  /** Primary supported type label. */
  kind: 'face' | 'fingerprint' | 'iris' | 'none';
}

export const getBiometricCapability = async (): Promise<BiometricCapability> => {
  try {
    const [hasHardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const available = hasHardware && enrolled && types.length > 0;
    const first = types[0];
    let kind: BiometricCapability['kind'] = 'none';
    if (
      first === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
    ) {
      kind = 'face';
    } else if (first === LocalAuthentication.AuthenticationType.IRIS) {
      kind = 'iris';
    } else if (types.length > 0) {
      kind = 'fingerprint';
    }
    return { available, enrolled, kind };
  } catch {
    return { available: false, enrolled: false, kind: 'none' };
  }
};

export interface BiometricPromptResult {
  success: boolean;
  reason?: string;
}

/** Prompt for biometric auth (used to unlock / confirm). */
export const promptBiometric = async (
  promptMessage: string,
  fallbackLabel?: string,
): Promise<BiometricPromptResult> => {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel,
      cancelLabel: fallbackLabel ?? 'إلغاء',
      disableDeviceFallback: false,
    });
    const maybeError = (result as { error?: string }).error;
    return { success: result.success, reason: maybeError ?? undefined };
  } catch (error) {
    return { success: false, reason: String(error) };
  }
};
