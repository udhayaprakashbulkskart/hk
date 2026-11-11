import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestApp, resetState, codeSentTo, PASSWORD, type TestApp } from "./helpers";

let t: TestApp;
const http = () => request(t.app.getHttpServer());

beforeAll(async () => { t = await startTestApp(); });
afterAll(async () => { await t.close(); });
beforeEach(async () => { await resetState(t); });

const newUser = { email: "amy.chan@example.com", phone: "+85255550123", password: PASSWORD, fullName: "Amy Chan", countryCode: "HK", language: "en" };

describe("registration", () => {
  it("creates a pending account and sends one code per channel", async () => {
    const res = await http().post("/v1/auth/register").send(newUser);
    expect(res.status).toBe(202);
    await t.drain();
    expect(codeSentTo(t.email, newUser.email)).toMatch(/^\d{6}$/);
    expect(codeSentTo(t.sms, newUser.phone)).toMatch(/^\d{6}$/);
    expect(await t.container.db.user.count()).toBe(1);
    expect((await t.container.db.user.findFirstOrThrow()).status).toBe("PENDING_VERIFICATION");
  });

  it("answers identically for an already registered email, and tells the owner", async () => {
    const first = await http().post("/v1/auth/register").send(newUser);
    const second = await http().post("/v1/auth/register").send({ ...newUser, phone: "+85255550999" });
    expect(second.status).toBe(first.status);
    expect(second.body).toEqual(first.body);
    expect(await t.container.db.user.count()).toBe(1);
    await t.drain();
    const owner = await t.container.db.user.findFirstOrThrow();
    const inbox = await t.container.db.notification.findMany({ where: { userId: owner.id } });
    expect(inbox.map((n) => n.title)).toContain("Registration attempt");
  });

  it("rejects weak and common passwords", async () => {
    const res = await http().post("/v1/auth/register").send({ ...newUser, password: "short1" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PASSWORD_POLICY");
    const common = await http().post("/v1/auth/register").send({ ...newUser, password: "password1234" });
    expect(common.body.error.code).toBe("PASSWORD_POLICY");
  });

  it("rejects an invalid mobile number", async () => {
    // Long enough to pass schema length checks, but not a real number, so the phone parser must reject it.
    const res = await http().post("/v1/auth/register").send({ ...newUser, phone: "+85255" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PHONE_INVALID");
  });

  it("rejects unknown fields instead of ignoring them", async () => {
    const res = await http().post("/v1/auth/register").send({ ...newUser, role: "ADMIN" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("activates the account once both codes are verified", async () => {
    await http().post("/v1/auth/register").send(newUser);
    await t.drain();
    const emailCode = codeSentTo(t.email, newUser.email);
    const smsCode = codeSentTo(t.sms, newUser.phone);
    const e = await http().post("/v1/auth/otp/verify").send({ email: newUser.email, channel: "EMAIL", code: emailCode });
    expect(e.body).toMatchObject({ verified: true, accountActive: false });
    const s = await http().post("/v1/auth/otp/verify").send({ email: newUser.email, channel: "SMS", code: smsCode });
    expect(s.body).toMatchObject({ verified: true, accountActive: true });
    expect((await t.container.db.user.findFirstOrThrow()).status).toBe("ACTIVE");
  });

  it("rejects a wrong code and locks the code after five attempts, even if correct later", async () => {
    await http().post("/v1/auth/register").send(newUser);
    await t.drain();
    const real = codeSentTo(t.email, newUser.email);
    const wrong = real === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) {
      const r = await http().post("/v1/auth/otp/verify").send({ email: newUser.email, channel: "EMAIL", code: wrong });
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe("OTP_INVALID");
    }
    const after = await http().post("/v1/auth/otp/verify").send({ email: newUser.email, channel: "EMAIL", code: real });
    expect(after.status).toBe(400);
    expect(after.body.error.code).toBe("OTP_INVALID");
  });

  it("rejects an expired code", async () => {
    await http().post("/v1/auth/register").send(newUser);
    await t.drain();
    const code = codeSentTo(t.email, newUser.email);
    await t.container.db.otpChallenge.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const r = await http().post("/v1/auth/otp/verify").send({ email: newUser.email, channel: "EMAIL", code });
    expect(r.body.error.code).toBe("OTP_INVALID");
  });

  it("stores verification codes only as keyed digests, never in plain text", async () => {
    await http().post("/v1/auth/register").send(newUser);
    await t.drain();
    const code = codeSentTo(t.email, newUser.email);
    const rows = await t.container.db.otpChallenge.findMany();
    expect(rows.every((r) => r.codeHash.length === 64 && r.codeHash !== code)).toBe(true);
  });

  it("removes the one-time code from the outbox after delivery", async () => {
    await http().post("/v1/auth/register").send(newUser);
    await t.drain();
    const rows = await t.container.db.outboxEvent.findMany();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(JSON.stringify(r.payload)).not.toMatch(/codeEnc/);
      expect((r.payload as Record<string, unknown>)["redacted"]).toBe(true);
    }
  });
});
