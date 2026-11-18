import { describe, expect, it } from "vitest";
import { commissionFor, discountPercent, formatINR, toPaise } from "@/lib/money";

describe("money", () => {
  it("converts rupees to integer paise without float drift", () => {
    expect(toPaise(19.99)).toBe(1999);
    expect(toPaise(0.1 + 0.2)).toBe(30);
  });
  it("computes commission in basis points, rounded", () => {
    expect(commissionFor(249_900, 1000)).toBe(24_990);
    expect(commissionFor(333, 1000)).toBe(33);
    expect(commissionFor(10_000, 0)).toBe(0);
  });
  it("formats INR with Indian grouping", () => {
    expect(formatINR(1_245_000)).toBe("₹12,450");
    expect(formatINR(249_950)).toBe("₹2,499.5");
  });
  it("computes discount percent", () => {
    expect(discountPercent(249_900, 349_900)).toBe(29);
    expect(discountPercent(100, null)).toBe(0);
    expect(discountPercent(200, 100)).toBe(0);
  });
});
