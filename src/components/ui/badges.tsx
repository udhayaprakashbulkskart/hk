import clsx from "clsx";
import { BadgeCheck, Star } from "lucide-react";
import { RARITY_LABEL, RARITY_STYLE } from "@/lib/constants";
import { discountPercent, formatINR } from "@/lib/money";
import type { Rarity } from "@/generated/prisma/enums";

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  return <span className={clsx("badge", RARITY_STYLE[rarity])}>{RARITY_LABEL[rarity]}</span>;
}

export function VerifiedBadge({ small }: { small?: boolean }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 font-medium text-neon-soft", small ? "text-[11px]" : "text-xs")} title="Verified seller">
      <BadgeCheck className={small ? "size-3.5" : "size-4"} /> Verified
    </span>
  );
}

export function Stars({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-zinc-300">
      <Star className="size-3.5 fill-amber-400 text-amber-400" />
      {value ? value.toFixed(1) : "New"}
      {count != null && <span className="text-zinc-500">({count})</span>}
    </span>
  );
}

export function Price({ price, compareAt, size = "md" }: { price: number; compareAt?: number | null; size?: "md" | "lg" }) {
  const off = discountPercent(price, compareAt);
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className={clsx("font-display font-bold text-white", size === "lg" ? "text-4xl text-neon" : "text-lg")}>{formatINR(price)}</span>
      {off > 0 && (
        <>
          <span className={clsx("text-zinc-500 line-through", size === "lg" ? "text-lg" : "text-xs")}>{formatINR(compareAt!)}</span>
          {size === "lg" && <span className="badge border-success/40 bg-success/15 text-success">{off}% OFF</span>}
        </>
      )}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  green: "border-success/40 bg-success/10 text-success",
  amber: "border-warn/40 bg-warn/10 text-warn",
  red: "border-mint/60 bg-mint/15 text-[#ff8a95]",
  zinc: "border-zinc-600 bg-zinc-800/60 text-zinc-300",
  sky: "border-sky-500/40 bg-sky-500/10 text-sky-300",
};
const STATUS_MAP: Record<string, keyof typeof STATUS_TONE> = {
  APPROVED: "green", VERIFIED: "green", PAID: "green", COMPLETED: "green", CAPTURED: "green", PROCESSED: "green", ACTIVE: "green", RESOLVED: "green", CREDIT: "green", CLOSED: "zinc",
  PENDING: "amber", PENDING_PAYMENT: "amber", PROCESSING: "sky", DELIVERED: "sky", REQUESTED: "amber", REFUND_REQUESTED: "amber", OPEN: "amber", IN_PROGRESS: "sky", CREATED: "amber", AWAITING_PAYMENT: "amber",
  REJECTED: "red", FAILED: "red", PAYMENT_FAILED: "red", SUSPENDED: "red", CANCELLED: "zinc", REFUNDED: "zinc", PARTIALLY_REFUNDED: "amber", ARCHIVED: "zinc", DRAFT: "zinc", DISMISSED: "zinc", DEBIT: "red", NONE: "zinc",
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={clsx("badge", STATUS_TONE[STATUS_MAP[status] ?? "zinc"])}>{status.replace(/_/g, " ")}</span>;
}
