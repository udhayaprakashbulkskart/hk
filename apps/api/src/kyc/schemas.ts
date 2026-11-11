import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date of birth must be YYYY-MM-DD");

export const identitySchema = z
  .object({
    pan: z.string().trim().max(10).optional(),
    passport: z.string().trim().max(12).optional(),
    dateOfBirth: isoDate,
    nationality: z.string().trim().length(2),
  })
  .strict();

export const submitSchema = z.object({ fullName: z.string().trim().min(2).max(120) }).strict();

export const documentKindSchema = z.enum(["PASSPORT", "HK_ID_CARD", "ADDRESS_PROOF", "PAN_CARD"]);

export const kycWebhookSchema = z
  .object({
    providerRef: z.string().min(1).max(128),
    outcome: z.enum(["PASS", "FAIL", "REVIEW"]),
    reason: z.string().max(200).optional(),
  })
  .strict();

export type IdentityBody = z.infer<typeof identitySchema>;
export type SubmitBody = z.infer<typeof submitSchema>;
export type KycWebhookBody = z.infer<typeof kycWebhookSchema>;
