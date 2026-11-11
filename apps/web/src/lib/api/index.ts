import type { FinHubApi } from "@hkfinhub/types";
import { sandboxApi } from "./sandbox";

/** The only place the UI obtains data. Swap the implementation for the real client in Phase 4. */
export const api: FinHubApi = sandboxApi;
export const DATA_MODE: "sandbox" | "live" = "sandbox";
