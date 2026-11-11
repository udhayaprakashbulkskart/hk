import { describe, expect, it } from "vitest";
import { decryptField, encryptField, keyedDigest, normaliseRecoveryCode, randomRecoveryCode, randomSixDigitCode, randomToken, safeEqualHex } from "../src/crypto";
import { assertPasswordPolicy, hashPassword, verifyPassword } from "../src/passwords";
import { normalisePhone, normaliseEmail } from "../src/phone";
import { AuthError } from "../src/errors";
import { checkTotp, newTotpSecret } from "../src/totp";
import { generateSync } from "otplib";
import { randomBytes } from "node:crypto";

const key = randomBytes(32);

describe("field encryption", () => {
  it("round-trips and uses a fresh nonce each time", () => {
    const a = encryptField(key, "123456");
    const b = encryptField(key, "123456");
    expect(a).not.toBe(b);
    expect(decryptField(key, a)).toBe("123456");
  });

  it("rejects tampering", () => {
    const env = Buffer.from(encryptField(key, "secret"), "base64");
    env[env.length - 1]! ^= 0xff;
    expect(() => decryptField(key, env.toString("base64"))).toThrow();
  });

  it("rejects a key of the wrong size", () => {
    expect(() => encryptField(randomBytes(16), "x")).toThrow(/32 bytes/);
  });
});

describe("digests and codes", () => {
  it("keyed digests are stable for the same input and differ across parts", () => {
    expect(keyedDigest(key, "otp", "a", "b")).toBe(keyedDigest(key, "otp", "a", "b"));
    expect(keyedDigest(key, "otp", "ab", "c")).not.toBe(keyedDigest(key, "otp", "a", "bc"));
  });

  it("compares digests in constant time and rejects length mismatch", () => {
    expect(safeEqualHex("ab", "ab")).toBe(true);
    expect(safeEqualHex("ab", "abcd")).toBe(false);
  });

  it("generates six-digit codes and tokens of the expected shape", () => {
    for (let i = 0; i < 50; i++) expect(randomSixDigitCode()).toMatch(/^\d{6}$/);
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomRecoveryCode()).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{2}$/);
  });

  it("normalises recovery codes typed in any case or with separators", () => {
    expect(normaliseRecoveryCode("ab3d-ef7g-hk")).toBe("AB3DEF7GHK");
  });
});

describe("passwords", () => {
  it("hashes with Argon2id and verifies", async () => {
    const h = await hashPassword("a-good-passphrase-1");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(h, "a-good-passphrase-1")).toBe(true);
    expect(await verifyPassword(h, "a-good-passphrase-2")).toBe(false);
  });

  it("enforces length, common-password and email-name rules", () => {
    expect(() => assertPasswordPolicy("short")).toThrow(AuthError);
    expect(() => assertPasswordPolicy("password1234")).toThrow(/too common/);
    expect(() => assertPasswordPolicy("amy-chan-passphrase-9", { email: "amychan@example.com" })).toThrow(/email name/);
    expect(() => assertPasswordPolicy("a-good-passphrase-1")).not.toThrow();
  });
});

describe("phone and email", () => {
  it("normalises Hong Kong numbers to E.164", () => {
    expect(normalisePhone("5555 0123", "HK")).toBe("+85255550123");
    expect(normalisePhone("+852 5555 0123")).toBe("+85255550123");
  });

  it("rejects invalid numbers", () => {
    expect(() => normalisePhone("+85255")).toThrow(/valid mobile/);
  });

  it("lower-cases and trims email", () => {
    expect(normaliseEmail("  Amy.Chan@Example.COM ")).toBe("amy.chan@example.com");
  });
});

describe("TOTP", () => {
  it("accepts the current code", async () => {
    const secret = newTotpSecret();
    const r = await checkTotp(secret, generateSync({ secret }), null);
    expect(r.valid).toBe(true);
  });

  it("rejects a time step already used", async () => {
    const secret = newTotpSecret();
    const code = generateSync({ secret });
    const first = await checkTotp(secret, code, null);
    if (!first.valid) throw new Error("expected valid");
    expect((await checkTotp(secret, code, first.step)).valid).toBe(false);
  });
});
