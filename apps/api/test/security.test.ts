import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";
import { ROUTES, buildOpenApi } from "../src/openapi";
import { startTestApp, resetState, codeSentTo, PASSWORD, DEVICE, provisionActive, testEnv, type TestApp } from "./helpers";

let t: TestApp;
const http = () => request(t.app.getHttpServer());
const EMAIL = "ed.wong@example.com";
const PHONE = "+85263334444";

beforeAll(async () => { t = await startTestApp(); });
afterAll(async () => { await t.close(); });
beforeEach(async () => { await resetState(t); });

describe("HTTP hardening", () => {
  it("sends security headers and echoes a safe request id", async () => {
    const res = await http().get("/v1/health").set("X-Request-Id", "abc12345-test");
    expect(res.headers["x-request-id"]).toBe("abc12345-test");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
  });

  it("replaces an unsafe request id with a generated one", async () => {
    const res = await http().get("/v1/health").set("X-Request-Id", "bad id with spaces & symbols!");
    expect(res.headers["x-request-id"]).not.toContain("bad id");
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rejects oversized request bodies", async () => {
    const res = await http().post("/v1/auth/login").set("Content-Type", "application/json").send(JSON.stringify({ email: "a@b.co", password: "x".repeat(20_000) }));
    expect(res.status).toBe(413);
  });

  it("does not expose stack traces for malformed JSON", async () => {
    const res = await http().post("/v1/auth/login").set("Content-Type", "application/json").send("{not json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(JSON.stringify(res.body)).not.toMatch(/\n\s+at |node_modules|\.ts:\d+|position/);
  });

  it("does not answer CORS for origins outside the allow-list", async () => {
    const res = await http().options("/v1/auth/login").set("Origin", "https://evil.example").set("Access-Control-Request-Method", "POST");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("rate limiting", () => {
  it("limits password guessing per account and returns Retry-After", async () => {
    await provisionActive(t, { email: EMAIL, phone: PHONE, name: "Ed Wong" });
    let last: request.Response | null = null;
    for (let i = 0; i < 12; i++) {
      last = await http().post("/v1/auth/login").send({ email: EMAIL, password: "guess-guess-guess-1", device: DEVICE });
      if (last.status === 429) break;
    }
    expect(last?.status).toBe(429);
    expect(last?.body.error.code).toBe("RATE_LIMITED");
    expect(Number(last?.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("every documented route is mounted: only a domain 404 is allowed, never the router's 404", async () => {
    for (const r of ROUTES) {
      const path = `/v1${r.path.replace(/\{[^}]+\}/g, "00000000-0000-7000-8000-000000000000")}`;
      const req = r.method === "get" ? http().get(path) : r.method === "delete" ? http().delete(path) : r.method === "put" ? http().put(path) : http().post(path);
      const res = await req.send({});
      // The router's own 404 says "No such endpoint." Any other response means the route exists.
      const routerMiss = res.status === 404 && res.body?.error?.message === "No such endpoint.";
      expect(routerMiss, `${r.method.toUpperCase()} ${path} is not mounted`).toBe(false);
    }
  });

  it("the OpenAPI document lists exactly the documented routes", async () => {
    const doc = buildOpenApi() as { paths: Record<string, Record<string, unknown>>; openapi: string };
    expect(doc.openapi).toBe("3.1.0");
    const documented = Object.entries(doc.paths).flatMap(([p, ops]) => Object.keys(ops).map((m) => `${m.toUpperCase()} ${p}`)).sort();
    const expected = ROUTES.map((r) => `${r.method.toUpperCase()} /v1${r.path}`).sort();
    expect(documented).toEqual(expected);
    const served = await http().get("/v1/openapi.json").expect(200);
    expect(served.body.paths["/v1/auth/login"]).toBeDefined();
  });
});

describe("audit trail", () => {
  it("records sign-in and cannot be rewritten or deleted", async () => {
    await provisionActive(t, { email: EMAIL, phone: PHONE, name: "Ed Wong" });
    await t.drain();
    await http().post("/v1/auth/login").send({ email: EMAIL, password: PASSWORD, device: DEVICE }).expect(200);
    const rows = await t.container.db.auditLog.findMany();
    expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(["login_user_provisioned", "login"]));

    await expect(t.container.db.$executeRawUnsafe(`UPDATE "AuditLog" SET "action" = 'tampered'`)).rejects.toThrow(/append-only/);
    await expect(t.container.db.$executeRawUnsafe(`DELETE FROM "AuditLog"`)).rejects.toThrow(/append-only/);
  });

  it("never stores a password or a plain code in the audit trail", async () => {
    await provisionActive(t, { email: EMAIL, phone: PHONE, name: "Ed Wong" });
    await http().post("/v1/auth/login").send({ email: EMAIL, password: "a-wrong-password-99", device: DEVICE });
    const dump = JSON.stringify(await t.container.db.auditLog.findMany());
    expect(dump).not.toContain(PASSWORD);
    expect(dump).not.toContain("a-wrong-password-99");
  });
});

describe("configuration", () => {
  const base = {
    DATABASE_URL: "postgresql://u:p@localhost:5432/d",
    REDIS_URL: "redis://localhost:6379",
    JWT_ACCESS_SECRET: "x".repeat(80),
    DIGEST_KEY: Buffer.alloc(32, 1).toString("base64"),
    FIELD_ENCRYPTION_KEY: Buffer.alloc(32, 2).toString("base64"),
  };

  it("refuses a short access-token secret", () => {
    expect(() => loadConfig({ ...base, JWT_ACCESS_SECRET: "short" })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it("refuses keys that are not 32 bytes", () => {
    expect(() => loadConfig({ ...base, DIGEST_KEY: Buffer.alloc(16).toString("base64") })).toThrow(/DIGEST_KEY/);
  });

  it("refuses capture providers in production", () => {
    expect(() => loadConfig({ ...base, APP_ENV: "production", EMAIL_PROVIDER: "capture" })).toThrow(/production/);
  });

  it("starts with no messaging provider configured, which fails closed on send", () => {
    const c = loadConfig({ ...base, APP_ENV: "local" });
    expect(c.emailProvider).toBe("none");
  });
});

describe("no customer signup", () => {
  it("does not serve the signup or verification-code routes", async () => {
    for (const path of ["/v1/auth/register", "/v1/auth/otp/verify", "/v1/auth/otp/resend"]) {
      const res = await http().post(path).send({});
      expect(res.status, path).toBe(404);
      expect(res.body?.error?.message, path).toBe("No such endpoint.");
    }
  });

  it("creates no operator account without a password, and uses the username default otherwise", async () => {
    const { loadConfig } = await import("../src/config");
    expect(loadConfig({ ...testEnv(), LOGIN_USER_PASSWORD: undefined }).loginUser).toBeUndefined();
    const cfg = loadConfig({ ...testEnv(), LOGIN_USER_PASSWORD: "a-long-enough-passphrase" });
    expect(cfg.loginUser?.email).toBe("pubgadmin@login.hkfinhub.internal");
  });
});
