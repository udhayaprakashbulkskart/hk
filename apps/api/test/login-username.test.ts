import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";
import { startTestApp, resetState, testEnv, PASSWORD, DEVICE, type TestApp } from "./helpers";
import { createFakeProviders } from "./provider-fake";

let t: TestApp;
const http = () => request(t.app.getHttpServer());

beforeAll(async () => { t = await startTestApp({ transport: createFakeProviders().transport }); });
afterAll(async () => { await t.close(); });
beforeEach(async () => { await resetState(t); });

describe("operator sign-in by username", () => {
  it("provisions the operator from configuration and signs in with the bare username", async () => {
    const cfg = loadConfig({ ...testEnv(), LOGIN_USER_PASSWORD: PASSWORD, LOGIN_USER_USERNAME: "pubgadmin" });
    const lu = cfg.loginUser!;
    expect(lu.email).toBe("pubgadmin@login.hkfinhub.internal");
    const first = await t.container.auth.provisionLoginUser({ ...lu, countryCode: "HK", language: "en" });
    expect(first.created).toBe(true);
    const again = await t.container.auth.provisionLoginUser({ ...lu, countryCode: "HK", language: "en" });
    expect(again.created).toBe(false);

    const res = await http().post("/v1/auth/login").send({ email: "pubgadmin", password: PASSWORD, device: DEVICE }).expect(200);
    expect(res.body.status).toBe("authenticated");
    expect(res.body.tokens.accessToken.split(".")).toHaveLength(3);
  });

  it("refuses a wrong password for the operator", async () => {
    const cfg = loadConfig({ ...testEnv(), LOGIN_USER_PASSWORD: PASSWORD });
    await t.container.auth.provisionLoginUser({ ...cfg.loginUser!, countryCode: "HK", language: "en" });
    const res = await http().post("/v1/auth/login").send({ email: "pubgadmin", password: "not-the-password-1", device: DEVICE });
    expect(res.status).toBe(401);
  });
});
