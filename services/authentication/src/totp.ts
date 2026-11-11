import { generateSecret, generateURI, verify } from "otplib";
import { POLICY } from "./policy";

export function newTotpSecret(): string {
  return generateSecret();
}

export function totpUri(issuer: string, label: string, secret: string): string {
  return generateURI({ issuer, label, secret });
}

/**
 * Verifies a six-digit TOTP code. Accepts one 30-second step either side of now, and rejects any
 * step at or before `lastUsedStep` so a code cannot be replayed.
 */
export async function checkTotp(secret: string, code: string, lastUsedStep: bigint | null): Promise<{ valid: true; step: bigint } | { valid: false }> {
  const result = await verify({
    secret,
    token: code,
    epochTolerance: 30 * POLICY.totpWindowSteps,
    ...(lastUsedStep !== null ? { afterTimeStep: Number(lastUsedStep) } : {}),
  });
  // A valid TOTP result always carries the matched time step. Anything else counts as a failure.
  if (!result.valid || !("timeStep" in result)) return { valid: false };
  return { valid: true, step: BigInt(result.timeStep) };
}
