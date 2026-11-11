import { z } from "zod";

const launch = z.enum(["HKD", "USD", "INR", "EUR", "GBP", "AED", "SGD", "CNY"]);
/** Money is an integer string in minor units. Never a float. */
const amount = z.string().regex(/^[1-9]\d{0,14}$/, "amountMinor must be a positive integer string");
const idemKey = z.string().min(8).max(128);
const uuid = z.uuid();

export const depositSchema = z
  .object({ currency: launch, amountMinor: amount, method: z.enum(["upi", "card", "bank"]), country: z.string().regex(/^[A-Z]{2}$/), idempotencyKey: idemKey })
  .strict();

export const internalTransferSchema = z
  .object({ toAccountRef: z.string().regex(/^HKA\d{8}$/, "use the recipient's HK FinHub account reference"), currency: launch, amountMinor: amount, idempotencyKey: idemKey })
  .strict();

export const payoutSchema = z
  .object({ beneficiaryId: uuid, sourceCurrency: launch, amountMinor: amount, fxQuoteId: uuid.nullable().optional(), idempotencyKey: idemKey })
  .strict();

export const withdrawalSchema = z
  .object({ beneficiaryId: uuid, sourceCurrency: launch, amountMinor: amount, idempotencyKey: idemKey })
  .strict();

export const fxQuoteSchema = z.object({ from: launch, to: launch, amountMinor: amount }).strict();
export const fxConvertSchema = z.object({ quoteId: uuid, idempotencyKey: idemKey }).strict();
export const requestCreateSchema = z.object({ currency: launch, amountMinor: amount.optional(), memo: z.string().max(80).default("") }).strict();
export const requestPaySchema = z
  .object({ method: z.enum(["upi", "card", "bank"]), country: z.string().regex(/^[A-Z]{2}$/), amountMinor: amount.optional(), idempotencyKey: idemKey })
  .strict();

export const providerParam = z.enum(["razorpay", "razorpayx", "stripe", "adyen"]);
