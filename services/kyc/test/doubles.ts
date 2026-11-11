import { createHash } from "node:crypto";
import type { KycProvider, MalwareScanner } from "../src";

/** The standard antivirus test string. Flagged by the sandbox scanner so the reject path can be tested. */
export const EICAR_TEST_STRING = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

/** SANDBOX ONLY. Flags the EICAR test string. Production needs a real scanning service. */
export function createSandboxScanner(): MalwareScanner {
  return {
    async scan(body) {
      return body.includes(Buffer.from(EICAR_TEST_STRING, "latin1")) ? "INFECTED" : "CLEAN";
    },
  };
}

/** SANDBOX ONLY. No vendor is contracted (decision D2). Returns a deterministic reference, never a real verdict. */
export function createSandboxKycProvider(): KycProvider {
  return {
    id: "sandbox-kyc",
    async startCheck({ userId }) {
      const providerRef = `sbx-${createHash("sha256").update(`kyc:${userId}`).digest("hex").slice(0, 24)}`;
      return { providerRef };
    },
  };
}
