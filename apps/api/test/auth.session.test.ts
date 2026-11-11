import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestApp, resetState, codeSentTo, PASSWORD, DEVICE, provisionActive, type TestApp } from "./helpers";

let t: TestApp;
const http = () => request(t.app.getHttpServer());
const EMAIL = "ben.lau@example.com";
const PHONE = "+85261234567";

beforeAll(async () => { t = await startTestApp(); });
afterAll(async () => { await t.close(); });
beforeEach(async () => { await resetState(t); });

/** Creates an active account through the real registration and verification endpoints. */
async function activeAccount(): Promise<void> {
  await provisionActive(t, { email: EMAIL, phone: PHONE, name: "Ben Lau" });
  await t.drain();
}

/** Returns the request itself (not a promise), so callers can chain .expect(...). */
function login(password = PASSWORD) {
  return http().post("/v1/auth/login").send({ email: EMAIL, password, device: DEVICE });
}

describe("login", () => {
  it("returns the same response for a wrong password and an unknown email", async () => {
    await activeAccount();
    const wrongPassword = await login("not-the-password-123");
    const unknown = await http().post("/v1/auth/login").send({ email: "nobody@example.com", password: PASSWORD, device: DEVICE });
    expect(wrongPassword.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknown.body);
    expect(wrongPassword.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("locks the account after five failures and notifies the owner", async () => {
    await activeAccount();
    for (let i = 0; i < 5; i++) await login("wrong-password-xx").expect(401);
    const locked = await login(); // correct password, still locked
    expect(locked.status).toBe(401);
    expect(locked.body.error.code).toBe("INVALID_CREDENTIALS");
    await t.drain();
    const user = await t.container.db.user.findFirstOrThrow({ where: { email: EMAIL } });
    expect(user.lockedUntil).not.toBeNull();
    const inbox = await t.container.db.notification.findMany({ where: { userId: user.id } });
    expect(inbox.map((n) => n.title)).toContain("Account temporarily locked");
  });

  it("issues tokens, serves /me, and ends the session on logout", async () => {
    await activeAccount();
    const res = await login().expect(200);
    expect(res.body.status).toBe("authenticated");
    const { accessToken, refreshToken } = res.body.tokens;
    expect(accessToken.split(".")).toHaveLength(3);

    const me = await http().get("/v1/me").set("Authorization", `Bearer ${accessToken}`).expect(200);
    expect(me.body).toMatchObject({ email: EMAIL, status: "ACTIVE", twoFactorEnabled: false });
    expect(me.body.profile.baseCurrency).toBe("HKD");

    await http().post("/v1/auth/logout").set("Authorization", `Bearer ${accessToken}`).expect(200);
    const after = await http().get("/v1/me").set("Authorization", `Bearer ${accessToken}`);
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe("SESSION_INVALID");
    const refreshAfter = await http().post("/v1/auth/refresh").send({ refreshToken });
    expect(refreshAfter.status).toBe(401);
  });

  it("rejects requests without a bearer token", async () => {
    const res = await http().get("/v1/me");
    expect(res.status).toBe(401);
  });
});

describe("refresh token rotation", () => {
  it("rotates on every use", async () => {
    await activeAccount();
    const first = (await login()).body.tokens;
    const second = await http().post("/v1/auth/refresh").send({ refreshToken: first.refreshToken }).expect(200);
    expect(second.body.refreshToken).not.toBe(first.refreshToken);
    await http().post("/v1/auth/refresh").send({ refreshToken: second.body.refreshToken }).expect(200);
  });

  it("ends the whole session when an already-used refresh token is presented again", async () => {
    await activeAccount();
    const first = (await login()).body.tokens;
    const rotated = await http().post("/v1/auth/refresh").send({ refreshToken: first.refreshToken }).expect(200);

    // An attacker replays the stolen, already-rotated token.
    const replay = await http().post("/v1/auth/refresh").send({ refreshToken: first.refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe("REFRESH_INVALID");

    // The legitimate holder's newest token no longer works either: the family is revoked.
    const legit = await http().post("/v1/auth/refresh").send({ refreshToken: rotated.body.refreshToken });
    expect(legit.status).toBe(401);
    await t.drain();
    const session = await t.container.db.session.findFirstOrThrow();
    expect(session.revokeReason).toBe("refresh_reuse");
    const inbox = await t.container.db.notification.findMany({ where: { userId: session.userId } });
    expect(inbox.map((n) => n.title)).toContain("Session ended for your protection");
  });

  it("rejects a garbage refresh token without revealing why", async () => {
    const res = await http().post("/v1/auth/refresh").send({ refreshToken: "a".repeat(40) });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("REFRESH_INVALID");
  });
});

describe("devices and sessions", () => {
  it("lists devices and signs one out, ending its access", async () => {
    await activeAccount();
    const phone = await http().post("/v1/auth/login").send({ email: EMAIL, password: PASSWORD, device: { name: "Pixel 8", platform: "android" } }).expect(200);
    const laptop = await login().expect(200);
    const devices = await http().get("/v1/auth/devices").set("Authorization", `Bearer ${laptop.body.tokens.accessToken}`).expect(200);
    expect(devices.body.devices.map((d: { name: string }) => d.name).sort()).toEqual(["Pixel 8", "Test browser"]);
    expect(devices.body.devices.filter((d: { current: boolean }) => d.current)).toHaveLength(1);

    const pixel = devices.body.devices.find((d: { name: string }) => d.name === "Pixel 8");
    await http().delete(`/v1/auth/devices/${pixel.id}`).set("Authorization", `Bearer ${laptop.body.tokens.accessToken}`).expect(200);
    const gone = await http().get("/v1/me").set("Authorization", `Bearer ${phone.body.tokens.accessToken}`);
    expect(gone.status).toBe(401);
  });

  it("sends a new-device alert the first time a device signs in only", async () => {
    await activeAccount();
    const dev = { id: undefined as string | undefined, name: "Test browser", platform: "web" as const };
    const first = await login().expect(200);
    dev.id = first.body.deviceId;
    await http().post("/v1/auth/login").send({ email: EMAIL, password: PASSWORD, device: dev }).expect(200);
    await t.drain();
    const user = await t.container.db.user.findFirstOrThrow({ where: { email: EMAIL } });
    const alerts = (await t.container.db.notification.findMany({ where: { userId: user.id } })).filter((n) => n.title === "New device signed in");
    expect(alerts).toHaveLength(1);
  });

  it("does not let a revoked device id be reattached: the next sign-in gets a fresh device", async () => {
    await activeAccount();
    const first = await login().expect(200);
    await http().delete(`/v1/auth/devices/${first.body.deviceId}`).set("Authorization", `Bearer ${first.body.tokens.accessToken}`).expect(200);
    const again = await http().post("/v1/auth/login").send({ email: EMAIL, password: PASSWORD, device: { ...DEVICE, id: first.body.deviceId } }).expect(200);
    expect(again.body.deviceId).not.toBe(first.body.deviceId);
  });
});
