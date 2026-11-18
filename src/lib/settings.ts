import "server-only";
import { db } from "./db";
import { DEFAULT_COMMISSION_BPS } from "./constants";

export const SETTING_KEYS = {
  commissionBps: "commission_bps",
  autoCompleteDays: "auto_complete_days",
} as const;

async function getNumber(key: string, fallback: number) {
  const row = await db.setting.findUnique({ where: { key } });
  const n = row ? Number(row.value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const getCommissionBps = () => getNumber(SETTING_KEYS.commissionBps, DEFAULT_COMMISSION_BPS);
export const getAutoCompleteDays = () => getNumber(SETTING_KEYS.autoCompleteDays, 3);

export async function setSetting(key: string, value: string | number) {
  await db.setting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } });
}
