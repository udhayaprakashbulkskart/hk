import { describe, expect, it } from "vitest";
import { checkoutSchema, productSchema, registerSchema, sellerOnboardSchema } from "@/lib/validation";

const validProduct = {
  title: "Glacier M416", description: "A max level Glacier M416 with kill effects.", categoryId: "c1", game: "BOTH", rarity: "MYTHIC",
  level: 7, maxLevel: 7, features: ["Kill Effect"], deliveryMethod: "IN_GAME_GIFT", price: 2499, compareAtPrice: 3499, stock: 1,
  media: [{ url: "/uploads/a.png", type: "IMAGE" }], complianceAck: true,
};

describe("validation", () => {
  it("requires strong-enough passwords and accepted terms", () => {
    expect(registerSchema.safeParse({ name: "A B", email: "a@b.co", password: "password", acceptTerms: true }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "A B", email: "a@b.co", password: "passw0rd!", acceptTerms: false }).success).toBe(false);
    expect(registerSchema.parse({ name: " A B ", email: "A@B.CO", password: "passw0rd!", acceptTerms: true }).email).toBe("a@b.co");
  });
  it("accepts a valid listing and enforces the compliance acknowledgement", () => {
    expect(productSchema.safeParse(validProduct).success).toBe(true);
    expect(productSchema.safeParse({ ...validProduct, complianceAck: false }).success).toBe(false);
  });
  it("rejects a compare-at price below the selling price", () => {
    const r = productSchema.safeParse({ ...validProduct, compareAtPrice: 100 });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["compareAtPrice"]);
  });
  it("limits media to 5 images and 1 video", () => {
    const img = (i: number) => ({ url: `/uploads/${i}.png`, type: "IMAGE" });
    expect(productSchema.safeParse({ ...validProduct, media: [1, 2, 3, 4, 5, 6].map(img) }).success).toBe(false);
    expect(productSchema.safeParse({ ...validProduct, media: [img(1), { url: "/uploads/v.mp4", type: "VIDEO" }, { url: "/uploads/w.mp4", type: "VIDEO" }] }).success).toBe(false);
    expect(productSchema.safeParse({ ...validProduct, media: [{ url: "javascript:alert(1)", type: "IMAGE" }] }).success).toBe(false);
  });
  it("only accepts numeric Player IDs at checkout (never credentials)", () => {
    expect(checkoutSchema.safeParse({ provider: "WALLET", gamePlayerId: "5123456789", game: "BGMI" }).success).toBe(true);
    expect(checkoutSchema.safeParse({ provider: "WALLET", gamePlayerId: "user@mail.com", game: "BGMI" }).success).toBe(false);
  });
  it("validates seller UPI and PAN fragments", () => {
    const base = { storeName: "My Store", legalName: "Real Name", panLast4: "12AB", payoutUpi: "me@okaxis", agree: true };
    expect(sellerOnboardSchema.safeParse(base).success).toBe(true);
    expect(sellerOnboardSchema.safeParse({ ...base, payoutUpi: "not-upi" }).success).toBe(false);
    expect(sellerOnboardSchema.safeParse({ ...base, panLast4: "ABCDE1234F" }).success).toBe(false);
  });
});
