import "server-only";
import { badRequest } from "../errors";
import { toPaise } from "../money";
import { isAllowedMediaUrl } from "../storage";
import type { campaignSchema, couponSchema } from "../validation";
import { normalizeCode } from "./coupons";

/** Admin form (rupees / percent) → stored coupon (paise / whole percent). */
export function couponData(input: ReturnType<typeof couponSchema.parse>) {
  return {
    code: normalizeCode(input.code),
    description: input.description || null,
    type: input.type,
    value: input.type === "FLAT" ? toPaise(input.value) : Math.round(input.value),
    minOrder: toPaise(input.minOrder),
    maxDiscount: input.maxDiscount ? toPaise(input.maxDiscount) : null,
    usageLimit: input.usageLimit ?? null,
    perUserLimit: input.perUserLimit,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    isActive: input.isActive,
  };
}


/** Admin form → stored campaign. Only keys present in `input` are written (safe for PATCH). Hero images must be our own media. */
export function campaignData(input: Partial<ReturnType<typeof campaignSchema.parse>>) {
  for (const u of [input.heroLeft, input.heroRight]) if (u && !isAllowedMediaUrl(u) && !u.startsWith("/media/")) throw badRequest("Use an uploaded image", { heroLeft: "Invalid image" });
  const out: Record<string, unknown> = { ...input };
  for (const k of ["kicker", "nativeTitle", "subtitle", "heroLeft", "heroRight"] as const) if (k in input) out[k] = input[k] || null;
  if ("endsAt" in input) out.endsAt = input.endsAt ? new Date(input.endsAt) : null;
  return out as Omit<typeof input, "endsAt"> & { endsAt?: Date | null };
}
