import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestApp, resetState, codeSentTo, PASSWORD, DEVICE, type TestApp } from "./helpers";

let t: TestApp;
const http = () => request(t.app.getHttpServer());
const EMAIL = "dan.yip@example.com";
const PHONE = "+85265554444";
const NEW_PASSWORD = "a-brand-new-passphrase-42";

beforeAll(async () => { t = await startTestApp(); });
afterAll(async () => { await t.close(); });
beforeEach(async () => { await resetState(t); });

async function activeLogin(): Promise<{ access: string; refresh: string }> {
  await http().post("/v1/auth/register").send({ email: EMAIL, phone: PHONE, password: PASSWORD, fullName: "Dan Yip", countryCode: "HK", language: "en" }).expect(202);
  await t.drain();
  await http().post("/v1/auth/otp/verify").send({ email: EMAIL, channel: "EMAIL", code: codeSentTo(t.email, EMAIL) }).expect(200);
  await http().post("/v1/auth/otp/verify").send({ email: EMAIL, channel: "SMS", code: codeSentTo(t.sms, PHONE) }).expect(200);
  const r = await http().post("/v1/auth/login").send({ email: EMAIL, password: PASSWORD, device: DEVICE }).expect(200);
  return { access: r.body.tokens.accessToken, refresh: r.body.tokens.refreshToken };
}

describe("password reset", () => {
  it("answers the same for unknown and known emails", async () => {
    await activeLogin();
    const known = await http().post("/v1/auth/password/reset/request").send({ email: EMAIL });
    const unknown = await http().post("/v1/auth/password/reset/request").send({ email: "nobody@example.com" });
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(unknown.body).toEqual(known.body);
  });

  it("resets the password with the emailed code and ends every session", async () => {
    const { access, refresh } = await activeLogin();
    await http().post("/v1/auth/password/reset/request").send({ email: EMAIL }).expect(202);
    await t.drain();
    const code = codeSentTo(t.email, EMAIL);
    await http().post("/v1/auth/password/reset/confirm").send({ email: EMAIL, code, newPassword: NEW_PASSWORD }).expect(200);

    expect((await http().get("/v1/me").set("Authorization", `Bearer ${access}`)).status).toBe(401);
    expect((await http().post("/v1/auth/refresh").send({ refreshToken: refresh })).status).toBe(401);
    expect((await http().post("/v1/auth/login").send({ email: EMAIL, password: PASSWORD, device: DEVICE })).status).toBe(401);
    await http().post("/v1/auth/login").send({ email: EMAIL, password: NEW_PASSWORD, device: DEVICE }).expect(200);
  });

  it("refuses a reset code that was already used", async () => {
    await activeLogin();
    await http().post("/v1/auth/password/reset/request").send({ email: EMAIL });
    await t.drain();
    const code = codeSentTo(t.email, EMAIL);
    await http().post("/v1/auth/password/reset/confirm").send({ email: EMAIL, code, newPassword: NEW_PASSWORD }).expect(200);
    const again = await http().post("/v1/auth/password/reset/confirm").send({ email: EMAIL, code, newPassword: "yet-another-passphrase-7" });
    expect(again.body.error.code).toBe("OTP_INVALID");
  });

  it("does not spend the code when the new password is rejected", async () => {
    await activeLogin();
    await http().post("/v1/auth/password/reset/request").send({ email: EMAIL });
    await t.drain();
    const code = codeSentTo(t.email, EMAIL);
    const weak = await http().post("/v1/auth/password/reset/confirm").send({ email: EMAIL, code, newPassword: "short" });
    expect(weak.body.error.code).toBe("PASSWORD_POLICY");
    await http().post("/v1/auth/password/reset/confirm").send({ email: EMAIL, code, newPassword: NEW_PASSWORD }).expect(200);
  });
});

describe("password change", () => {
  it("requires the current password and keeps only the current session", async () => {
    const first = await activeLogin();
    const second = await http().post("/v1/auth/login").send({ email: EMAIL, password: PASSWORD, device: { name: "Other", platform: "ios" } }).expect(200);
    const wrong = await http().post("/v1/auth/password/change").set("Authorization", `Bearer ${first.access}`).send({ current: "nope-nope-nope-1", next: NEW_PASSWORD });
    expect(wrong.status).toBe(401);
    await http().post("/v1/auth/password/change").set("Authorization", `Bearer ${first.access}`).send({ current: PASSWORD, next: NEW_PASSWORD }).expect(200);
    expect((await http().get("/v1/me").set("Authorization", `Bearer ${first.access}`)).status).toBe(200);
    expect((await http().get("/v1/me").set("Authorization", `Bearer ${second.body.tokens.accessToken}`)).status).toBe(401);
  });
});
