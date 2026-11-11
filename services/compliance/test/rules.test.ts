import { describe, expect, it } from "vitest";
import { applicableRules, checkLimit, windowStart, limitError } from "../src/limits";
import { structuringDetected, velocityBreached } from "../src/rules";

const now = new Date("2026-11-11T10:00:00Z");
const ev = (minutesAgo: number, amountMinor: bigint) => ({ at: new Date(now.getTime() - minutesAgo * 60_000), amountMinor });

describe("velocity", () => {
  it("alerts only when the count in the window exceeds the maximum", () => {
    const p = { windowMs: 60 * 60_000, maxCount: 3 };
    expect(velocityBreached([ev(1, 1n), ev(2, 1n), ev(3, 1n)], now, p)).toBe(false);
    expect(velocityBreached([ev(1, 1n), ev(2, 1n), ev(3, 1n), ev(4, 1n)], now, p)).toBe(true);
  });
  it("ignores events outside the window", () => {
    expect(velocityBreached([ev(61, 1n), ev(90, 1n), ev(120, 1n), ev(200, 1n)], now, { windowMs: 60 * 60_000, maxCount: 1 })).toBe(false);
  });
});

describe("structuring", () => {
  const p = { threshold: 1_000_000n, lowerBound: 900_000n, windowMs: 24 * 60 * 60_000, minCount: 3 };
  it("flags repeated just-under-threshold transfers", () => {
    expect(structuringDetected([ev(10, 950_000n), ev(20, 980_000n), ev(30, 910_000n)], now, p)).toBe(true);
  });
  it("does not flag amounts well below the band or at/over the threshold", () => {
    expect(structuringDetected([ev(10, 100_000n), ev(20, 200_000n), ev(30, 1_000_000n)], now, p)).toBe(false);
  });
});

describe("limits", () => {
  it("uses the start of the UTC day and month", () => {
    expect(windowStart("DAILY", now).toISOString()).toBe("2026-11-11T00:00:00.000Z");
    expect(windowStart("MONTHLY", now).toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });
  it("applies both the corridor rule and the default, and the stricter one bites", () => {
    const rules = [
      { tier: "STANDARD", corridor: "*", scope: "PER_TX" as const, currency: "HKD", amountMinor: 5_000_000n },
      { tier: "STANDARD", corridor: "IN", scope: "PER_TX" as const, currency: "HKD", amountMinor: 1_000_000n },
      { tier: "STANDARD", corridor: "GB", scope: "PER_TX" as const, currency: "HKD", amountMinor: 1n },
    ];
    expect(applicableRules(rules, "STANDARD", "IN", "HKD")).toHaveLength(2);
    const breach = checkLimit(rules[1]!, 0n, 1_500_000n);
    expect(breach).not.toBeNull();
  });
  it("reports the limit and the used amount with the LIMIT_EXCEEDED code", () => {
    const rule = { tier: "STANDARD", corridor: "*", scope: "DAILY" as const, currency: "HKD", amountMinor: 10_000_000n };
    const breach = checkLimit(rule, 9_500_000n, 1_000_000n)!;
    const err = limitError(breach, "HKD");
    expect(err.code).toBe("LIMIT_EXCEEDED");
    expect(err.message).toContain("100,000.00 HKD");
    expect(err.details).toMatchObject({ limitMinor: "10000000", usedMinor: "9500000", requestedMinor: "1000000" });
  });
  it("allows a transfer that lands exactly on the limit", () => {
    expect(checkLimit({ tier: "T", corridor: "*", scope: "PER_TX", currency: "HKD", amountMinor: 100n }, 0n, 100n)).toBeNull();
  });
});
