import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ROLE_PERMISSIONS, type Permission } from "@hkfinhub/admin";
import { CURRENCY_META } from "@hkfinhub/shared";
import { CONTAINER } from "../constants";
import type { Container } from "../container";
import { mapDomainError } from "../common/domain-errors";
import { ZodPipe } from "../common/zod-pipe";
import { StaffGuard, type AdminRequest } from "./staff.guard";
import {
  adjustmentSchema, clearCaseSchema, decisionSchema, kycDecisionSchema, limitChangeSchema, providerRequestSchema, revealSchema, staffSchema,
} from "./schemas";
import { z } from "zod";

/**
 * Every endpoint checks one permission on the server before doing anything. Refusals are audited.
 * Domain services keep their own role checks too (for example, compliance decisions).
 */
@Controller("admin")
@UseGuards(StaffGuard)
export class AdminController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  private async run<T>(req: AdminRequest, permission: Permission, subject: { type: string; id: string | null }, fn: () => Promise<T>): Promise<T> {
    try {
      await this.c.admin.require(req.staff, permission, subject);
      return await fn();
    } catch (err) {
      return mapDomainError(err);
    }
  }

  @Get("me")
  me(@Req() req: AdminRequest) {
    return { userId: req.staff.id, role: req.staff.role, permissions: [...ROLE_PERMISSIONS[req.staff.role]] };
  }

  @Get("customers/:userId")
  customer(@Param("userId") userId: string, @Req() req: AdminRequest) {
    return this.run(req, "customers.read", { type: "User", id: userId }, async () => {
      const kyc = await this.c.kyc.status(userId);
      return { userId, kyc: { status: kyc.status, tier: kyc.tier, verifiedAt: kyc.verifiedAt, missing: kyc.missing } };
    });
  }

  @Get("kyc/:userId")
  kycStatus(@Param("userId") userId: string, @Req() req: AdminRequest) {
    return this.run(req, "kyc.read", { type: "User", id: userId }, () => this.c.kyc.status(userId));
  }

  @Post("kyc/:userId/decision")
  @HttpCode(200)
  kycDecision(@Param("userId") userId: string, @Body(new ZodPipe(kycDecisionSchema)) body: z.infer<typeof kycDecisionSchema>, @Req() req: AdminRequest) {
    return this.run(req, "kyc.decide", { type: "User", id: userId }, async () => ({
      status: await this.c.kyc.decide({ id: req.staff.id, role: req.staff.role }, userId, body.decision, body.reason),
    }));
  }

  /** Streams one identity document. The service writes the audit row before the bytes are read. */
  @Get("kyc/documents/:fileId")
  async kycDocument(@Param("fileId") fileId: string, @Query("reason") reason: string | undefined, @Req() req: AdminRequest, @Res() res: Response) {
    try {
      await this.c.admin.require(req.staff, "kyc.document.read", { type: "KycFile", id: fileId });
      const out = await this.c.kyc.readDocumentForReview({ id: req.staff.id, role: req.staff.role }, fileId, reason ?? "");
      res.setHeader("Cache-Control", "no-store");
      res.type(out.file.mimeType).send(out.body);
      return;
    } catch (err) {
      return mapDomainError(err);
    }
  }

  @Get("compliance/cases")
  cases(@Req() req: AdminRequest) {
    return this.run(req, "compliance.read", { type: "ComplianceCase", id: null }, async () => ({ items: await this.c.compliance.openCases(100) }));
  }

  @Post("compliance/cases/:caseId/clear")
  @HttpCode(200)
  clearCase(@Param("caseId") caseId: string, @Body(new ZodPipe(clearCaseSchema)) body: z.infer<typeof clearCaseSchema>, @Req() req: AdminRequest) {
    return this.run(req, "compliance.clear", { type: "ComplianceCase", id: caseId }, async () => {
      await this.c.compliance.clearCase({ id: req.staff.id, role: req.staff.role }, caseId, body.note);
      return { ok: true };
    });
  }

  @Post("limits/changes")
  @HttpCode(201)
  requestLimit(@Body(new ZodPipe(limitChangeSchema)) body: z.infer<typeof limitChangeSchema>, @Req() req: AdminRequest) {
    return this.run(req, "limits.request", { type: "LimitRule", id: null }, async () => ({
      approvalId: await this.c.compliance.requestLimitChange({ id: req.staff.id, role: req.staff.role }, {
        tier: body.tier,
        corridor: body.corridor,
        scope: body.scope,
        currency: body.currency,
        amountMinor: BigInt(body.amountMinor),
        reason: body.reason,
      }),
    }));
  }

  @Post("limits/changes/:approvalId/decision")
  @HttpCode(200)
  decideLimit(@Param("approvalId") approvalId: string, @Body(new ZodPipe(decisionSchema)) body: z.infer<typeof decisionSchema>, @Req() req: AdminRequest) {
    return this.run(req, "limits.approve", { type: "ApprovalRequest", id: approvalId }, async () => {
      await this.c.compliance.decideLimitChange({ id: req.staff.id, role: req.staff.role }, approvalId, body.decision);
      return { ok: true };
    });
  }

  @Post("adjustments")
  @HttpCode(201)
  requestAdjustment(@Body(new ZodPipe(adjustmentSchema)) body: z.infer<typeof adjustmentSchema>, @Req() req: AdminRequest) {
    return this.run(req, "adjustments.request", { type: "LedgerAdjustment", id: null }, async () => ({
      approvalId: await this.c.adjustments.request(req.staff.id, body),
    }));
  }

  @Post("adjustments/:approvalId/approve")
  @HttpCode(200)
  approveAdjustment(@Param("approvalId") approvalId: string, @Req() req: AdminRequest) {
    return this.run(req, "adjustments.approve", { type: "ApprovalRequest", id: approvalId }, () => this.c.adjustments.approve(req.staff.id, approvalId));
  }

  @Post("provider-approvals")
  @HttpCode(201)
  requestProvider(@Body(new ZodPipe(providerRequestSchema)) body: z.infer<typeof providerRequestSchema>, @Req() req: AdminRequest) {
    return this.run(req, "provider.config.request", { type: "Provider", id: body.providerId }, async () => ({
      approvalId: await this.c.admin.requestProviderApproval({ id: req.staff.id, role: req.staff.role }, body),
    }));
  }

  @Post("provider-approvals/:approvalId/decision")
  @HttpCode(200)
  decideProvider(@Param("approvalId") approvalId: string, @Body(new ZodPipe(decisionSchema)) body: z.infer<typeof decisionSchema>, @Req() req: AdminRequest) {
    return this.run(req, "provider.config.approve", { type: "ApprovalRequest", id: approvalId }, async () => {
      await this.c.admin.decideProviderApproval({ id: req.staff.id, role: req.staff.role }, approvalId, body.decision);
      return { ok: true };
    });
  }

  @Get("approvals")
  approvals(@Req() req: AdminRequest) {
    return this.run(req, "approvals.read", { type: "ApprovalRequest", id: null }, async () => ({ items: await this.c.admin.pendingApprovals() }));
  }

  @Post("customers/:userId/reveal")
  @HttpCode(200)
  reveal(@Param("userId") userId: string, @Body(new ZodPipe(revealSchema)) body: z.infer<typeof revealSchema>, @Req() req: AdminRequest) {
    return this.run(req, "customers.pii.reveal", { type: "User", id: userId }, async () => ({
      field: body.field,
      value: await this.c.admin.revealPii({ id: req.staff.id, role: req.staff.role }, userId, body.field, body.reason),
    }));
  }

  @Get("users")
  users(@Query("limit") limit: string | undefined, @Req() req: AdminRequest) {
    const n = Math.min(Math.max(Number(limit ?? 50) || 50, 1), 200);
    return this.run(req, "customers.read", { type: "User", id: null }, async () => ({ items: await this.c.admin.listUsers({ id: req.staff.id, role: req.staff.role }, n) }));
  }

  @Get("payments")
  payments(@Query("limit") limit: string | undefined, @Req() req: AdminRequest) {
    const n = Math.min(Math.max(Number(limit ?? 50) || 50, 1), 200);
    return this.run(req, "payments.read", { type: "Payment", id: null }, async () => ({ items: (await this.c.admin.listPayments({ id: req.staff.id, role: req.staff.role }, n)).map((p) => ({ ...p, amountMinor: p.amountMinor.toString() })) }));
  }

  @Get("transfers")
  transfers(@Query("limit") limit: string | undefined, @Req() req: AdminRequest) {
    const n = Math.min(Math.max(Number(limit ?? 50) || 50, 1), 200);
    return this.run(req, "transfers.read", { type: "Transfer", id: null }, async () => ({ items: (await this.c.admin.listTransfers({ id: req.staff.id, role: req.staff.role }, n)).map((t) => ({ ...t, sourceMinor: t.sourceMinor.toString() })) }));
  }

  /** Ledger reconciliation: every account whose stored balance disagrees with its entries. Read-only. */
  @Get("reports/reconciliation")
  reconciliation(@Req() req: AdminRequest) {
    return this.run(req, "finance.read", { type: "Report", id: "reconciliation" }, async () => {
      const r = await this.c.ledger.reconcile(new Date());
      return {
        checked: r.checked,
        mismatches: r.mismatches.map((m) => ({ accountId: m.accountId, expectedMinor: m.expectedMinor.toString(), recordedMinor: m.recordedMinor.toString() })),
      };
    });
  }

  /** Launch currencies and their minor-unit rules, from the shared metadata. */
  @Get("currencies")
  currencies(@Req() req: AdminRequest) {
    return this.run(req, "finance.read", { type: "Currency", id: null }, async () => ({
      items: Object.values(CURRENCY_META).map((m) => ({ code: m.code, name: m.name, symbol: m.symbol, minorUnitExponent: m.minorUnitExponent })),
    }));
  }

  /** Feature flags and environment only. No secrets, keys or provider credentials are returned. */
  @Get("settings")
  settings(@Req() req: AdminRequest) {
    return this.run(req, "settings.read", { type: "Settings", id: null }, async () => ({
      appEnvironment: this.c.config.appEnv,
      paymentEnvironment: this.c.config.paymentEnvironment,
      liveFeatures: {
        payments: this.c.config.liveFeaturePayments,
        transfers: this.c.config.liveFeatureTransfers,
        trading: false,
      },
      adminNetworkRestricted: this.c.config.adminAllowedIps.length > 0,
      investmentBroker: this.c.investmentBroker ? "configured" : "none",
    }));
  }

  @Get("audit")
  audit(@Query("limit") limit: string | undefined, @Req() req: AdminRequest) {
    const n = Math.min(Math.max(Number(limit ?? 50) || 50, 1), 200);
    return this.run(req, "audit.read", { type: "AuditLog", id: null }, async () => ({ items: await this.c.admin.recentAudit({ id: req.staff.id, role: req.staff.role }, n) }));
  }

  @Post("staff")
  @HttpCode(201)
  setStaff(@Body(new ZodPipe(staffSchema)) body: z.infer<typeof staffSchema>, @Req() req: AdminRequest) {
    return this.run(req, "staff.manage", { type: "User", id: body.userId }, async () => {
      await this.c.admin.setStaffRole({ id: req.staff.id, role: req.staff.role }, body.userId, body.role);
      return { ok: true };
    });
  }
}
