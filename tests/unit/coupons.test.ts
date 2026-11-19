import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ db: {} }));
const { allocate, discountFor, normalizeCode } = await import("@/lib/services/coupons");

describe("coupon maths", () => {
  it("normalises codes", () => expect(normalizeCode(" lunar 10 ")).toBe("LUNAR10"));
  it("percent with cap", () => {
    expect(discountFor({ type: "PERCENT", value: 10, maxDiscount: null }, 100_000)).toBe(10_000);
    expect(discountFor({ type: "PERCENT", value: 10, maxDiscount: 5_000 }, 100_000)).toBe(5_000);
    expect(discountFor({ type: "PERCENT", value: 33, maxDiscount: null }, 1_001)).toBe(330); // floors
  });
  it("flat, always leaving ₹1 payable", () => {
    expect(discountFor({ type: "FLAT", value: 5_000, maxDiscount: null }, 29_900)).toBe(5_000);
    expect(discountFor({ type: "FLAT", value: 50_000, maxDiscount: null }, 29_900)).toBe(29_800);
    expect(discountFor({ type: "FLAT", value: 5_000, maxDiscount: null }, 50)).toBe(0);
  });
  it("allocates proportionally and exactly", () => {
    expect(allocate(1_000, [3_000, 1_000])).toEqual([750, 250]);
    const parts = allocate(1_001, [1_000, 1_000, 1_000]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1_001);
    expect(allocate(0, [500, 500])).toEqual([0, 0]);
  });
});
