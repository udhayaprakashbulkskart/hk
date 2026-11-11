import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AuthError } from "@hkfinhub/authentication";
import { CONTAINER } from "../constants";
import type { Container } from "../container";
import { ZodPipe } from "../common/zod-pipe";
import { AuthGuard, requestContext, type AuthedRequest } from "./auth.guard";
import {
  changePasswordSchema, loginSchema, mfaLoginSchema, refreshSchema, registerSchema, resendOtpSchema,
  resetConfirmSchema, resetRequestSchema, totpCodeSchema, verifyOtpSchema,
  type LoginInput, type MfaLoginInput, type RegisterInput,
} from "./schemas";
import { z } from "zod";

const uuid = z.uuid();

/** Customer authentication endpoints. Business rules live in @hkfinhub/authentication. */
@Controller("auth")
export class AuthController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  @Post("register")
  @HttpCode(202)
  register(@Body(new ZodPipe(registerSchema)) body: RegisterInput, @Req() req: Request) {
    return this.c.auth.register(body, requestContext(req));
  }

  @Post("otp/resend")
  @HttpCode(202)
  resend(@Body(new ZodPipe(resendOtpSchema)) body: { email: string; channel: "EMAIL" | "SMS" }) {
    return this.c.auth.resendOtp(body);
  }

  @Post("otp/verify")
  @HttpCode(200)
  verifyOtp(@Body(new ZodPipe(verifyOtpSchema)) body: { email: string; channel: "EMAIL" | "SMS"; code: string }, @Req() req: Request) {
    return this.c.auth.verifyOtp(body, requestContext(req));
  }

  @Post("login")
  @HttpCode(200)
  login(@Body(new ZodPipe(loginSchema)) body: LoginInput, @Req() req: Request) {
    return this.c.auth.login(body, requestContext(req));
  }

  @Post("login/mfa")
  @HttpCode(200)
  loginMfa(@Body(new ZodPipe(mfaLoginSchema)) body: MfaLoginInput, @Req() req: Request) {
    return this.c.auth.completeMfaLogin(body, requestContext(req));
  }

  @Post("refresh")
  @HttpCode(200)
  refresh(@Body(new ZodPipe(refreshSchema)) body: { refreshToken: string }, @Req() req: Request) {
    return this.c.auth.refresh(body.refreshToken, requestContext(req));
  }

  @Post("logout")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async logout(@Req() req: AuthedRequest) {
    await this.c.auth.logout({ sub: req.auth.userId, sid: req.auth.sessionId, did: req.auth.deviceId }, requestContext(req));
    return { ok: true };
  }

  @Post("password/reset/request")
  @HttpCode(202)
  resetRequest(@Body(new ZodPipe(resetRequestSchema)) body: { email: string }, @Req() req: Request) {
    return this.c.auth.requestPasswordReset(body.email, requestContext(req));
  }

  @Post("password/reset/confirm")
  @HttpCode(200)
  async resetConfirm(@Body(new ZodPipe(resetConfirmSchema)) body: { email: string; code: string; newPassword: string }, @Req() req: Request) {
    await this.c.auth.confirmPasswordReset(body, requestContext(req));
    return { ok: true };
  }

  @Post("password/change")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async changePassword(@Body(new ZodPipe(changePasswordSchema)) body: { current: string; next: string }, @Req() req: AuthedRequest) {
    await this.c.auth.changePassword({ userId: req.auth.userId, sessionId: req.auth.sessionId, ...body }, requestContext(req));
    return { ok: true };
  }

  @Post("2fa/totp/enroll")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  enroll(@Req() req: AuthedRequest) {
    return this.c.auth.enrollTotp(req.auth.userId);
  }

  @Post("2fa/totp/confirm")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  confirm(@Body(new ZodPipe(totpCodeSchema)) body: { code: string }, @Req() req: AuthedRequest) {
    return this.c.auth.confirmTotp(req.auth.userId, body.code, requestContext(req));
  }

  @Post("2fa/totp/disable")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async disable(@Body(new ZodPipe(totpCodeSchema)) body: { code: string }, @Req() req: AuthedRequest) {
    await this.c.auth.disableTotp(req.auth.userId, body.code, requestContext(req));
    return { ok: true };
  }

  @Get("devices")
  @UseGuards(AuthGuard)
  async devices(@Req() req: AuthedRequest) {
    return { devices: await this.c.auth.listDevices(req.auth.userId, req.auth.sessionId) };
  }

  @Delete("devices/:id")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async revokeDevice(@Param("id") id: string, @Req() req: AuthedRequest) {
    const parsed = uuid.safeParse(id);
    if (!parsed.success) throw new AuthError("NOT_FOUND", "Device not found.");
    await this.c.auth.revokeDevice(req.auth.userId, parsed.data, requestContext(req));
    return { ok: true };
  }
}

@Controller("me")
export class MeController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  @Get()
  @UseGuards(AuthGuard)
  me(@Req() req: AuthedRequest) {
    return this.c.auth.me(req.auth.userId);
  }
}

