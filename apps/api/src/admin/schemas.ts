import { z } from "zod";
import { PERMISSIONS, ROLES, PROVIDER_IDS, ENVIRONMENTS, REVEAL_FIELDS, REVEAL_REASONS } from "@hkfinhub/admin";

const amount = z.string().regex(/^\d{1,18}$/, "amount must be whole minor units");

export const kycDecisionSchema = z.object({ decision: z.enum(["APPROVE", "REJECT", "REQUEST_INFO"]), reason: z.string().trim().min(10).max(200) }).strict();
export const clearCaseSchema = z.object({ note: z.string().trim().min(10).max(500) }).strict();
export const limitChangeSchema = z
  .object({
    tier: z.enum(["STANDARD"]),
    corridor: z.string().trim().min(1).max(4),
    scope: z.enum(["PER_TX", "DAILY", "MONTHLY"]),
    currency: z.string().trim().length(3),
    amountMinor: amount,
    reason: z.string().trim().min(10).max(300),
  })
  .strict();
export const decisionSchema = z.object({ decision: z.enum(["APPROVED", "REJECTED"]) }).strict();
export const adjustmentSchema = z
  .object({
    customerAccountId: z.string().min(1),
    counterAccountId: z.string().min(1),
    currency: z.string().trim().length(3),
    amountMinor: amount,
    direction: z.enum(["CREDIT", "DEBIT"]),
    reason: z.string().trim().min(10).max(300),
  })
  .strict();
export const providerRequestSchema = z
  .object({ providerId: z.enum(PROVIDER_IDS), environment: z.enum(ENVIRONMENTS), contractRef: z.string().trim().min(4).max(64) })
  .strict();
export const revealSchema = z.object({ field: z.enum(REVEAL_FIELDS), reason: z.enum(REVEAL_REASONS) }).strict();
export const staffSchema = z.object({ userId: z.string().min(1), role: z.enum(ROLES) }).strict();
export const permissionNames = PERMISSIONS;
