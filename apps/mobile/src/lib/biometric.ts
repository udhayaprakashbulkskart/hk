import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";

export type BiometricState =
  | { supported: false; reason: string }
  | { supported: true; kind: "face" | "fingerprint" | "other" };

/** Reports whether biometric unlock can be offered on this device. */
export async function biometricState(): Promise<BiometricState> {
  if (Platform.OS === "web") return { supported: false, reason: "Biometrics are available in the mobile app." };
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return { supported: false, reason: "This device has no biometric sensor." };
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) return { supported: false, reason: "Set up Face ID or fingerprint in your device settings first." };
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const finger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
  return { supported: true, kind: face ? "face" : finger ? "fingerprint" : "other" };
}

/** Prompts for biometric or device passcode. Returns true only on success. */
export async function unlockWithBiometrics(reason: string): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  });
  return r.success;
}
