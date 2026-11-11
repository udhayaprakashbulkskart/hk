import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { AuthError } from "@hkfinhub/authentication";
import { CONTAINER } from "../constants";
import type { Container } from "../container";

export interface AuthContext {
  userId: string;
  sessionId: string;
  deviceId: string;
}

export type AuthedRequest = Request & { auth: AuthContext; id?: string };

/** Requires a bearer access token whose session is still active. Attaches `req.auth`. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (typeof header !== "string" || !header.startsWith("Bearer ")) {
      throw new AuthError("SESSION_INVALID", "Your session has ended. Please log in again.");
    }
    req.auth = await this.c.auth.authenticate(header.slice(7).trim());
    return true;
  }
}

export function requestContext(req: Request): { ip: string | null; userAgent: string | null } {
  return { ip: req.ip ?? null, userAgent: req.get("user-agent") ?? null };
}
