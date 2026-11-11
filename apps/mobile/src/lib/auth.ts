import { Platform } from "react-native";
import { createAuthClient, type DevicePayload } from "@hkfinhub/api-client";

/** Customer API base URL. Set EXPO_PUBLIC_API_URL per build. On a device, use the machine's LAN address, not localhost. */
export const authClient = createAuthClient({
  baseUrl: process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:4000",
});

export function currentDevice(): DevicePayload {
  const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
  return { name: platform === "ios" ? "iPhone" : platform === "android" ? "Android phone" : "Web browser", platform };
}

export interface ApiErrorLike {
  code?: string;
  message?: string;
  retryAfterSeconds?: number;
}

/** Plain-language message for an API failure. Codes are stable; wording never reveals account existence. */
export function messageFor(err: unknown): string {
  const e = err as ApiErrorLike;
  if (e && e.code === "RATE_LIMITED") return `Too many attempts. Try again in ${Math.ceil((e.retryAfterSeconds ?? 60) / 60)} minute(s).`;
  if (e && e.code === "VERIFICATION_REQUIRED") return "This account is not active. Contact the HK FinHub team for help.";
  if (e && e.code === "ACCOUNT_UNAVAILABLE") return "This account is not available. Contact support.";
  if (e && e.message) return e.message;
  return "Something went wrong. Please try again.";
}
