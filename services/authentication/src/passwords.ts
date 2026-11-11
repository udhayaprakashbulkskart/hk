import { hash, verify } from "@node-rs/argon2";
import { AuthError } from "./errors";
import { POLICY } from "./policy";

// OWASP minimum for Argon2id: 19 MiB memory, 2 iterations, 1 lane.
const ARGON2 = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

// A few of the most common breached passwords. Not a substitute for a full breach corpus check
// (k-anonymity lookup), which is queued for Phase 7 with the compliance providers.
const COMMON = new Set([
  "password1234", "123456789012", "qwertyuiop12", "iloveyou1234", "letmein12345",
  "password12345", "welcome12345", "administrator", "hongkong2024", "hkfinhub1234",
]);

export function assertPasswordPolicy(password: string, context: { email?: string; name?: string } = {}): void {
  if (password.length < POLICY.passwordMinLength) {
    throw new AuthError("PASSWORD_POLICY", `Password must be at least ${POLICY.passwordMinLength} characters.`);
  }
  if (password.length > POLICY.passwordMaxLength) {
    throw new AuthError("PASSWORD_POLICY", `Password must be at most ${POLICY.passwordMaxLength} characters.`);
  }
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) throw new AuthError("PASSWORD_POLICY", "That password is too common. Choose another.");
  // Compare without separators, so "amy-chan" in a password still matches "amychan@" in an email.
  const squash = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
  const localPart = context.email ? squash(context.email.split("@")[0] ?? "") : "";
  if (localPart.length >= 4 && squash(password).includes(localPart)) {
    throw new AuthError("PASSWORD_POLICY", "Password must not contain your email name.");
  }
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password).catch(() => false);
}

/** Computed once. Used to spend the same time on unknown accounts as on real ones. */
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword("timing-equalisation-only-never-a-real-password");
  return dummyHash;
}
