import { afterAll, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";
import { createContainer } from "../src/container";
import { testEnv } from "./helpers";

describe("starts without Redis", () => {
  const cfg = loadConfig({ ...testEnv(), REDIS_URL: "" });
  const c = createContainer(cfg);
  afterAll(async () => { await c.close(); });

  it("has no Redis client and loads no Redis configuration", () => {
    expect(cfg.redisUrl).toBeUndefined();
    expect(c.redis).toBeNull();
  });

  it("limits attempts through Postgres: allowed up to the limit, then refused with a retry time", async () => {
    const key = `probe-${Date.now()}`;
    const first = await c.limiter.hit(key, 2, 60);
    const second = await c.limiter.hit(key, 2, 60);
    const third = await c.limiter.hit(key, 2, 60);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
    await c.db.rateLimit.deleteMany({ where: { key } });
  });

  it("the readiness check still answers when Postgres is up and Redis is not configured", async () => {
    await c.db.$queryRaw`SELECT 1`;
  });
});
