import { CanActivate, ExecutionContext, HttpException, Inject, Injectable } from "@nestjs/common";
import { CONTAINER } from "../constants";
import type { Container } from "../container";
import { AuthGuard, requestContext, type AuthedRequest } from "../auth/auth.guard";

export interface AdminRequest extends AuthedRequest {
  staff: { id: string; role: "SUPER_ADMIN" | "FINANCE_ADMIN" | "COMPLIANCE_ADMIN" | "SUPPORT_ADMIN" };
}

/**
 * Admin access: a valid session, an ACTIVE staff record, confirmed two-factor, and (when configured) an allowed
 * network. Every refusal is audited. Production refuses to serve admin routes until ADMIN_ALLOWED_IPS is set.
 */
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AdminRequest>();
    await new AuthGuard(this.c).canActivate(ctx);
    const allowed = this.c.config.adminAllowedIps;
    if (this.c.config.appEnv === "production" && allowed.length === 0) {
      throw new HttpException({ code: "NOT_AVAILABLE", message: "This is not yet available." }, 503);
    }
    const ip = requestContext(req).ip;
    if (allowed.length > 0 && (!ip || !allowed.includes(ip))) {
      await this.c.adminStore.audit({ actorUserId: req.auth.userId, action: "admin_network_denied", subjectType: "Admin", subjectId: null, metadata: { ip } });
      throw new HttpException({ code: "FORBIDDEN", message: "Admin access is not allowed from this network." }, 403);
    }
    const staff = await this.c.adminStore.staffFor(req.auth.userId);
    if (!staff || staff.status !== "ACTIVE" || !staff.totpConfirmed) {
      await this.c.adminStore.audit({ actorUserId: req.auth.userId, action: "admin_access_denied", subjectType: "Admin", subjectId: null });
      throw new HttpException({ code: "FORBIDDEN", message: "Admin access is not available for this account." }, 403);
    }
    req.staff = { id: req.auth.userId, role: staff.role };
    return true;
  }
}
