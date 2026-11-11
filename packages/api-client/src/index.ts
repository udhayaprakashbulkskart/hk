import type { FinHubApi } from "@hkfinhub/types";
import { unavailableApi } from "./unavailable";

/**
 * The only place customer clients obtain data (web and mobile). Until the screens are wired to the
 * live API this returns empty results, never sample figures.
 */
export const api: FinHubApi = unavailableApi;
export const DATA_MODE: "unavailable" = "unavailable";
export * from "./money";

export { createAuthClient, ApiError, type AuthClient, type LoginOutcome, type TokenPair, type DevicePayload } from "./auth-http";
