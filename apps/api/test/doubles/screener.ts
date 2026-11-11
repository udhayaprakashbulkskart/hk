import type { SanctionsScreener } from "@hkfinhub/compliance";

/**
 * TEST ONLY. Not a real sanctions list. It flags one fixed test name so tests can drive the hold path.
 * Production uses the screening vendor chosen under decision D2.
 */
export const TEST_SANCTIONED_NAME = "TEST SANCTIONED";

export function createTestScreener(): SanctionsScreener {
  return {
    id: "test-screener",
    async screen({ name }) {
      const hit = name.toUpperCase().includes(TEST_SANCTIONED_NAME);
      return { hits: hit ? [{ list: "TEST-LIST", score: 100 }] : [] };
    },
  };
}
