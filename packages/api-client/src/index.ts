import type { FinHubApi } from "@hkfinhub/types";
import { sandboxApi } from "./sandbox";

/**
 * The only place customer clients obtain data (web and mobile).
 * Phase 4 replaces this with the real HTTP client behind the same FinHubApi interface.
 */
export const api: FinHubApi = sandboxApi;
export const DATA_MODE: "sandbox" | "live" = "sandbox";
export * from "./money";
