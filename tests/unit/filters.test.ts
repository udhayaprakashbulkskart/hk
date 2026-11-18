import { describe, expect, it } from "vitest";
import { buildWhere, parseFilters } from "@/lib/services/catalog";

describe("marketplace filters", () => {
  it("parses query params into typed filters, converting rupees to paise", () => {
    const f = parseFilters({ q: " m416 ", rarity: "MYTHIC,BOGUS,EPIC", min: "100", max: "5000", sort: "price_desc", game: "BGMI", page: "2" });
    expect(f).toMatchObject({ q: "m416", rarity: ["MYTHIC", "EPIC"], minPrice: 10_000, maxPrice: 500_000, sort: "price_desc", game: "BGMI", page: 2 });
  });
  it("falls back to safe defaults for junk input", () => {
    const f = parseFilters({ sort: "drop table", min: "-5", page: "abc", game: "XBOX" });
    expect(f.sort).toBe("newest");
    expect(f.minPrice).toBeUndefined();
    expect(f.page).toBe(1);
    expect(f.game).toBeUndefined();
  });
  it("always restricts public queries to approved, in-stock items", () => {
    expect(buildWhere({})).toMatchObject({ status: "APPROVED", stock: { gt: 0 } });
  });
  it("includes cross-game items when filtering by one game", () => {
    const w = buildWhere({ game: "BGMI" }) as { AND: unknown[] };
    expect(w.AND).toContainEqual({ game: { in: ["BGMI", "BOTH"] } });
  });
});
