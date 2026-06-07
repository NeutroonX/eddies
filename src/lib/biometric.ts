import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export const BIOMETRIC_SUPPORTED_PLATFORM = Platform.OS === 'android';

export async function isBiometricAvailable(): Promise<boolean> {
  if (!BIOMETRIC_SUPPORTED_PLATFORM) return false;
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

export async function authenticate(reason: string): Promise<boolean> {
  if (!BIOMETRIC_SUPPORTED_PLATFORM) return true;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'CANCEL',
    disableDeviceFallback: false,
  });
  return result.success;
}
