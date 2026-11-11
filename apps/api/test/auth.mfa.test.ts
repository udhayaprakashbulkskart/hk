import request from "supertest";
import { generateSecret, generateSync } from "otplib";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestApp, resetState, codeSentTo, PASSWORD, DEVICE, type TestApp } from "./helpers";

let t: TestApp;
const http = () => request(t.app.getHttpServer());
const EMAIL = "cathy.ho@example.com";
const PHONE = "+85291234567";

beforeAll(async () => { t = await startTestApp(); });
afterAll(async () => { await t.close(); });
beforeEach(async () => { await resetState(t); });

async function activeLogin(): Promise<string> {
  await http().post("/v1/auth/register").send({ email: EMAIL, phone: PHONE, password: PASSWORD, fullName: "Cathy Ho", countryCode: "HK", language: "en" }).expect(202);
  await t.drain();
  await http().post("/v1/auth/otp/verify").send({ email: EMAIL, channel: "EMAIL", code: codeSentTo(t.email, EMAIL) }).expect(200);
  await http().post("/v1/auth/otp/verify").send({ email: EMAIL, channel: "SMS", code: codeSentTo(t.sms, PHONE) }).expect(200);
  const res = await http().post("/v1/auth/login").send({ email: EMAIL, password: PASSWORD, device: DEVICE }).expect(200);
  return res.body.tokens.accessToken as string;
}

/** Enrols authenticator 2FA through the API and returns the secret, as a user's app would hold it. */
async function enrol(access: string): Promise<{ secret: string; recoveryCodes: string[] }> {
  const enrolled = await http().post("/v1/auth/2fa/totp/enroll").set("Authorization", `Bearer ${access}`).expect(200);
  const secret = enrolled.body.secret as string;
  expect(enrolled.body.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
  const code = generateSync({ secret });
  const confirmed = await http().post("/v1/auth/2fa/totp/confirm").set("Authorization", `Bearer ${access}`).send({ code }).expect(200);
  return { secret, recoveryCodes: confirmed.body.recoveryCodes as string[] };
}

describe("two-factor authentication", () => {
  it("enrols, returns ten recovery codes once, and turns on for login", async () => {
    const access = await activeLogin();
    const { recoveryCodes } = await enrol(access);
    expect(recoveryCodes).toHaveLength(10);
    expect(new Set(recoveryCodes).size).toBe(10);
    const me = await http().get("/v1/me").set("Authorization", `Bearer ${access}`);
    expect(me.body).toMatchObject({ twoFactorEnabled: true, recoveryCodesRemaining: 10 });
    await t.drain();
    const stored = await t.container.db.recoveryCode.findMany();
    expect(stored.every((r) => r.codeHash.length === 64 && !recoveryCodes.includes(r.codeHash))).toBe(true);
  });

  it("requires a second step at login and completes with an authenticator code", async () => {
    const access = await activeLogin();
    const { secret } = await enrol(access);
    const first = await http().post("/v1/auth/login").send({ email: EMAIL, password: PASSWORD, device: DEVICE }).expect(200);
    expect(first.body.status).toBe("mfa_required");
    expect(first.body.tokens).toBeUndefined();

    // Enrolment used the current 30-second step, so a login code must come from a later step.
    const code = generateSync({ secret, epoch: Math.floor(Date.now() / 1000) + 30 });
    const done = await http().post("/v1/auth/login/mfa").send({ mfaToken: first.body.mfaToken, code, device: DEVICE });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe("authenticated");
  });

  it("does not accept the same authenticator code twice", async () => {
    const access = await activeLogin();
    const { secret } = await enrol(access);
    const code = generateSync({ secret, epoch: Math.floor(Date.now() / 1000) + 30 });
    const a = await http().post("/v1/auth/login").send({ email: EMAIL, password: PASSWORD, device: DEVICE }).expect(200);
    await http().post("/v1/auth/login/mfa").send({ mfaToken: a.body.mfaToken, code, device: DEVICE }).expect(200);
    const b = await http().post("/v1/auth/login").send({ email: EMAIL, password: PASSWORD, device: DEVICE }).expect(200);
    const replay = await http().post("/v1/auth/login/mfa").send({ mfaToken: b.body.mfaToken, code, device: DEVICE });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe("MFA_INVALID");
  });

  it("accepts a recovery code once, then refuses it", async () => {
    const access = await activeLogin();
    const { recoveryCodes } = await enrol(access);
    const a = await http().post("/v1/auth/login").send({ email: EMAIL, password: PASSWORD, device: DEVICE }).expect(200);
    const ok = await http().post("/v1/auth/login/mfa").send({ mfaToken: a.body.mfaToken, recoveryCode: recoveryCodes[0]!.toLowerCase(), device: DEVICE });
    expect(ok.status).toBe(200);
    const b = await http().post("/v1/auth/login").send({ email: EMAIL, password: PASSWORD, device: DEVICE }).expect(200);
    const again = await http().post("/v1/auth/login/mfa").send({ mfaToken: b.body.mfaToken, recoveryCode: recoveryCodes[0], device: DEVICE });
    expect(again.status).toBe(401);
  });

  it("rejects a wrong authenticator code and stops after five tries", async () => {
    const access = await activeLogin();
    await enrol(access);
    const a = await http().post("/v1/auth/login").send({ email: EMAIL, password: PASSWORD, device: DEVICE }).expect(200);
    for (let i = 0; i < 5; i++) {
      const r = await http().post("/v1/auth/login/mfa").send({ mfaToken: a.body.mfaToken, code: "000001", device: DEVICE });
      expect(r.body.error.code).toBe("MFA_INVALID");
    }
    const after = await http().post("/v1/auth/login/mfa").send({ mfaToken: a.body.mfaToken, code: generateSync({ secret: generateSecret() }), device: DEVICE });
    expect(after.body.error.code).toBe("MFA_CHALLENGE_INVALID");
  });

  it("refuses to confirm setup with a wrong code", async () => {
    const access = await activeLogin();
    await http().post("/v1/auth/2fa/totp/enroll").set("Authorization", `Bearer ${access}`).expect(200);
    const r = await http().post("/v1/auth/2fa/totp/confirm").set("Authorization", `Bearer ${access}`).send({ code: "123123" });
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe("MFA_INVALID");
  });

  it("does not allow enrolment twice once two-factor is on", async () => {
    const access = await activeLogin();
    await enrol(access);
    const again = await http().post("/v1/auth/2fa/totp/enroll").set("Authorization", `Bearer ${access}`);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("TOTP_ALREADY_ENABLED");
  });
});
