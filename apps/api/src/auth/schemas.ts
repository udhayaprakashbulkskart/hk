import { z } from "zod";

// Every request body is strict: unknown fields are rejected, not ignored.
const email = z.email().max(254);
const otpCode = z.string().regex(/^\d{6}$/, "must be six digits");
const phone = z.string().min(6).max(24);
const device = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1).max(80),
    platform: z.enum(["web", "ios", "android"]),
  })
  .strict();

export const registerSchema = z
  .object({
    email,
    phone,
    password: z.string().min(1).max(256),
    fullName: z.string().trim().min(2).max(120),
    countryCode: z.string().regex(/^[A-Z]{2}$/, "use a two-letter ISO country code"),
    language: z.enum(["en", "zh-HK", "zh-CN", "hi"]),
  })
  .strict();

export const resendOtpSchema = z.object({ email, channel: z.enum(["EMAIL", "SMS"]) }).strict();
export const verifyOtpSchema = z.object({ email, channel: z.enum(["EMAIL", "SMS"]), code: otpCode }).strict();
export const loginSchema = z.object({ email, password: z.string().min(1).max(256), device }).strict();

export const mfaLoginSchema = z
  .object({
    mfaToken: z.string().min(20).max(200),
    code: otpCode.optional(),
    recoveryCode: z.string().min(8).max(32).optional(),
    device,
  })
  .strict()
  .refine((v) => (v.code !== undefined) !== (v.recoveryCode !== undefined), "send either code or recoveryCode");

export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200) }).strict();
export const resetRequestSchema = z.object({ email }).strict();
export const resetConfirmSchema = z.object({ email, code: otpCode, newPassword: z.string().min(1).max(256) }).strict();
export const changePasswordSchema = z.object({ current: z.string().min(1).max(256), next: z.string().min(1).max(256) }).strict();
export const totpCodeSchema = z.object({ code: otpCode }).strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type MfaLoginInput = z.infer<typeof mfaLoginSchema>;
