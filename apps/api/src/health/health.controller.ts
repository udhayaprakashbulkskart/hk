import { Controller, Get, HttpCode, HttpException, HttpStatus, Inject } from "@nestjs/common";
import { CONTAINER } from "../constants";
import type { Container } from "../container";

@Controller()
export class HealthController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  /** Liveness: the process is up. Cheap, no dependencies. */
  @Get("health")
  @HttpCode(200)
  health() {
    return { status: "ok" };
  }

  /** Readiness: Postgres and Redis answer. Load balancers use this before sending traffic. */
  @Get("ready")
  @HttpCode(200)
  async ready() {
    const checks: Record<string, "ok" | "down"> = {};
    try { await this.c.db.$queryRaw`SELECT 1`; checks["postgres"] = "ok"; } catch { checks["postgres"] = "down"; }
    try { await this.c.redis.ping(); checks["redis"] = "ok"; } catch { checks["redis"] = "down"; }
    const ok = Object.values(checks).every((v) => v === "ok");
    if (!ok) throw new HttpException({ status: "unavailable", checks }, HttpStatus.SERVICE_UNAVAILABLE);
    return { status: "ready", checks };
  }
}
