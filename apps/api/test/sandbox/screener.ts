import type { SanctionsScreener } from "@hkfinhub/compliance";

/**
 * SANDBOX ONLY. Not a real sanctions list. It flags one fixed test name so tests can drive the hold path.
 * Production uses the screening vendor chosen under decision D2.
 */
export const SANDBOX_SANCTIONED_NAME = "SANDBOX SANCTIONED";

export function createSandboxScreener(): SanctionsScreener {
  return {
    id: "sandbox-screener",
    async screen({ name }) {
      const hit = name.toUpperCase().includes(SANDBOX_SANCTIONED_NAME);
      return { hits: hit ? [{ list: "SANDBOX-TEST-LIST", score: 100 }] : [] };
    },
  };
}
