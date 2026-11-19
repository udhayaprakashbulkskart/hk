import type { DeliveryMethod, Game, Rarity } from "@/generated/prisma/enums";

export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "ZYNOFLIX STORE";

export const DISCLAIMER =
  "Independent fan marketplace. Not affiliated with, endorsed or sponsored by KRAFTON, Inc., PUBG Corporation, Tencent, or any game publisher. PUBG MOBILE and BATTLEGROUNDS MOBILE INDIA are trademarks of their respective owners.";

export const GAME_LABEL: Record<Game, string> = {
  PUBG_MOBILE: "PUBG Mobile",
  BGMI: "BGMI",
  BOTH: "PUBG Mobile & BGMI",
};

export const RARITY_LABEL: Record<Rarity, string> = {
  COMMON: "Common",
  RARE: "Rare",
  EPIC: "Epic",
  LEGENDARY: "Legendary",
  MYTHIC: "Mythic",
};

export const RARITY_STYLE: Record<Rarity, string> = {
  COMMON: "text-zinc-300 bg-[#1c0507]/85 border-zinc-500/30",
  RARE: "text-sky-300 bg-[#1c0507]/85 border-sky-500/30",
  EPIC: "text-violet-300 bg-[#1c0507]/85 border-violet-500/30",
  LEGENDARY: "text-amber-300 bg-[#1c0507]/85 border-amber-500/30",
  MYTHIC: "text-rose-300 bg-[#1c0507]/85 border-rose-500/40",
};

export const DELIVERY_LABEL: Record<DeliveryMethod, string> = {
  IN_GAME_GIFT: "Official in-game gift to your Player ID",
  REDEEM_CODE: "Official redeem code",
  UC_TOPUP: "UC top-up to your Player ID",
};

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most popular" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
] as const;
export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export const DEFAULT_COMMISSION_BPS = 1000; // 10%
export const MIN_WITHDRAWAL_PAISE = 10_000; // ₹100
export const MAX_IMAGES = 5;
export const MAX_VIDEOS = 1;

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")).replace(/\/$/, "");
