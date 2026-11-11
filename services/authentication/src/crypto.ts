import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** URL-safe random token, e.g. for refresh tokens. 32 bytes is 256 bits of entropy. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Keyed digest for values we must look up later but never store in plain text (OTPs, tokens). */
export function keyedDigest(key: Uint8Array, ...parts: string[]): string {
  const h = createHmac("sha256", key);
  for (const p of parts) {
    h.update(String(p.length)); // length prefix prevents ambiguity between parts
    h.update(":");
    h.update(p);
    h.update("|");
  }
  return h.digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Six-digit one-time code with uniform distribution. */
export function randomSixDigitCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

// Excludes easily confused characters (0/O, 1/I/L).
const RECOVERY_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Recovery code shown once, formatted XXXX-XXXX-XX. */
export function randomRecoveryCode(): string {
  const pick = (n: number) => Array.from({ length: n }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]).join("");
  return `${pick(4)}-${pick(4)}-${pick(2)}`;
}

/** Normalises user-typed recovery codes: case and separators do not matter. */
export function normaliseRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** AES-256-GCM envelope: base64(iv || tag || ciphertext). Used for TOTP secrets and outbox OTP payloads. */
export function encryptField(key: Uint8Array, plaintext: string): string {
  if (key.length !== 32) throw new Error("field key must be 32 bytes");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptField(key: Uint8Array, envelope: string): string {
  if (key.length !== 32) throw new Error("field key must be 32 bytes");
  const buf = Buffer.from(envelope, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
