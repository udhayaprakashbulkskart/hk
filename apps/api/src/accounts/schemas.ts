import { z } from "zod";

export const openCurrencySchema = z.object({ currency: z.enum(["HKD", "USD", "INR", "EUR", "GBP", "AED", "SGD", "CNY"]) }).strict();

export const beneficiarySchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    country: z.string().regex(/^[A-Z]{2}$/, "use a two-letter ISO country code"),
    method: z.enum(["upi", "bank", "swift"]),
    destination: z.string().trim().min(4).max(64),
    currency: z.enum(["HKD", "USD", "INR", "EUR", "GBP", "AED", "SGD", "CNY"]),
  })
  .strict();

export type BeneficiaryBody = z.infer<typeof beneficiarySchema>;
