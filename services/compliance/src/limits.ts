import { ComplianceError } from "./errors";

export type LimitScope = "PER_TX" | "DAILY" | "MONTHLY";

export interface LimitRule {
  tier: string;
  corridor: string;
  scope: LimitScope;
  currency: string;
  amountMinor: bigint;
}

/** Start of the UTC day or month that the window belongs to. */
export function windowStart(scope: Exclude<LimitScope, "PER_TX">, now: Date): Date {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return scope === "DAILY" ? new Date(Date.UTC(y, m, now.getUTCDate())) : new Date(Date.UTC(y, m, 1));
}

/**
 * Every rule that applies to this transfer. A corridor-specific rule and the "*" default both apply,
 * so the stricter one always wins.
 */
export function applicableRules(rules: LimitRule[], tier: string, corridor: string, currency: string): LimitRule[] {
  return rules.filter(
    (r) => r.tier === tier && r.currency === currency && (r.corridor === "*" || r.corridor === corridor),
  );
}

export interface LimitBreach {
  scope: LimitScope;
  corridor: string;
  limitMinor: bigint;
  usedMinor: bigint;
  requestedMinor: bigint;
}

/** Returns the first breach, or null. The caller supplies `used` for the rule's window. */
export function checkLimit(rule: LimitRule, usedMinor: bigint, requestedMinor: bigint): LimitBreach | null {
  if (usedMinor + requestedMinor <= rule.amountMinor) return null;
  return {
    scope: rule.scope,
    corridor: rule.corridor,
    limitMinor: rule.amountMinor,
    usedMinor,
    requestedMinor,
  };
}

/** The error a customer sees. It names the limit and what has already been used, so they know why. */
export function limitError(b: LimitBreach, currency: string): ComplianceError {
  const scopeText = b.scope === "PER_TX" ? "per transfer" : b.scope === "DAILY" ? "per day" : "per month";
  return new ComplianceError(
    "LIMIT_EXCEEDED",
    `this exceeds your ${scopeText} limit of ${formatMinor(b.limitMinor)} ${currency}`,
    {
      scope: b.scope,
      corridor: b.corridor,
      currency,
      limitMinor: b.limitMinor.toString(),
      usedMinor: b.usedMinor.toString(),
      requestedMinor: b.requestedMinor.toString(),
    },
  );
}

function formatMinor(v: bigint): string {
  const whole = v / 100n;
  const cents = (v % 100n).toString().padStart(2, "0");
  return `${whole.toLocaleString("en-US")}.${cents}`;
}
