import { BadRequestException, Body, Controller, Get, HttpCode, HttpException, Inject, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { CONTAINER } from "../constants";
import type { Container } from "../container";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { mapDomainError } from "../common/domain-errors";
import { ZodPipe } from "../common/zod-pipe";
import { documentKindSchema, identitySchema, kycWebhookSchema, submitSchema, type IdentityBody, type SubmitBody } from "./schemas";

@Controller("kyc")
export class KycController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  /** Status, what is still missing, masked identifiers and document list. Decrypted values never leave the server. */
  @Get()
  @UseGuards(AuthGuard)
  async status(@Req() req: AuthedRequest) {
    return this.c.kyc.status(req.auth.userId);
  }

  @Put("identity")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async identity(@Body(new ZodPipe(identitySchema)) body: IdentityBody, @Req() req: AuthedRequest) {
    try {
      await this.c.kyc.saveIdentity(req.auth.userId, body);
      return { ok: true };
    } catch (err) {
      return mapDomainError(err);
    }
  }

  /** Raw bytes. Content-Type must match the file's real type. The service sniffs the bytes and does not trust the label. */
  @Post("documents")
  @HttpCode(201)
  @UseGuards(AuthGuard)
  async upload(@Query("kind") kind: string | undefined, @Req() req: AuthedRequest & Request) {
    const parsedKind = documentKindSchema.safeParse(kind);
    if (!parsedKind.success) throw new BadRequestException({ code: "VALIDATION_FAILED", message: "unknown document kind" });
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const mimeType = String(req.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase();
    try {
      const f = await this.c.kyc.uploadDocument(req.auth.userId, { kind: parsedKind.data, mimeType, body: raw });
      return { id: f.id, kind: f.kind, sizeBytes: f.sizeBytes, mimeType: f.mimeType, scanStatus: f.scanStatus, uploadedAt: f.createdAt.toISOString() };
    } catch (err) {
      return mapDomainError(err);
    }
  }

  /** Sends the case for checking. Sanctions screening runs first, so a hit is recorded before any verdict. */
  @Post("submit")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async submit(@Body(new ZodPipe(submitSchema)) body: SubmitBody, @Req() req: AuthedRequest) {
    const userId = req.auth.userId;
    try {
      const out = await this.c.kyc.submit(userId, body.fullName, async ({ dateOfBirth, country }) => {
        await this.c.compliance.screenSubject({ subjectType: "USER", subjectId: userId, accountId: null, name: body.fullName, dateOfBirth, country });
      });
      return { status: out.status };
    } catch (err) {
      return mapDomainError(err);
    }
  }

  /**
   * Identity provider verdicts. Signed with HMAC-SHA256 over the raw body; the contract is provisional until the
   * vendor is chosen (decision D2). A PASS is held while any blocking compliance case is open.
   */
  @Post("webhook")
  @HttpCode(200)
  async webhook(@Req() req: Request) {
    const secret = this.c.config.kyc.webhookSecret;
    if (!secret) throw new HttpException({ code: "NOT_AVAILABLE", message: "This is not yet available." }, 503);
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const given = Buffer.from(String(req.headers["x-kyc-signature"] ?? ""));
    const expected = Buffer.from(createHmac("sha256", secret).update(raw).digest("hex"));
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new HttpException({ code: "INVALID_SIGNATURE", message: "Webhook signature check failed." }, 401);
    }
    let json: unknown;
    try {
      json = JSON.parse(raw.toString("utf8"));
    } catch {
      throw new BadRequestException({ code: "VALIDATION_FAILED", message: "invalid JSON" });
    }
    const parsed = kycWebhookSchema.safeParse(json);
    if (!parsed.success) throw new BadRequestException({ code: "VALIDATION_FAILED", message: "invalid webhook body" });
    try {
      await this.c.kyc.applyProviderResult(
        { providerRef: parsed.data.providerRef, outcome: parsed.data.outcome, ...(parsed.data.reason ? { reason: parsed.data.reason } : {}) },
        { hasBlockingCase: (userId) => this.c.compliance.hasBlockingCase(userId) },
      );
      return { received: true };
    } catch (err) {
      return mapDomainError(err);
    }
  }
}
