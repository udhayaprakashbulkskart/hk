import { ComplianceError } from "./errors";
import type { SanctionsScreener } from "./ports";

/**
 * Production stand-in until a screening vendor is approved (decision D2). It FAILS CLOSED: any screening
 * request is refused, so no recipient or customer can be added or paid unscreened.
 */
export function createUnconfiguredScreener(): SanctionsScreener {
  return {
    id: "unconfigured",
    async screen() {
      throw new ComplianceError("NOT_AVAILABLE", "screening is not yet available");
    },
  };
}
