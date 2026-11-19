/**
 * End-to-end business flows against a running server + real Postgres.
 * Run with: npm run test:integration (see README) — requires the seed data and the server
 * started with the test env (mock Razorpay on :4010, RATE_LIMIT_DISABLED=true).
 */
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client, login, register, uid } from "../support/http";
import { MockRazorpay } from "../support/mock-razorpay";
import { tdb } from "../support/db";

const KEY_SECRET = "rzp_test_secret_for_tests";
const WEBHOOK_SECRET = "whsec_for_tests";
const rzp = new MockRazorpay();
let admin: Client;
let weaponCat: string;

const sig = (s: string, k: string) => createHmac("sha256", k).update(s).digest("hex");
const balance = async (email: string) => (await tdb.user.findUniqueOrThrow({ where: { email } })).walletBalance;
const fund = async (email: string, paise: number) => {
  // Fixture: credit a test wallet through the ledger, exactly like an admin adjustment would.
  const u = await tdb.user.update({ where: { email }, data: { walletBalance: { increment: paise } } });
  await tdb.walletTransaction.create({ data: { userId: u.id, type: "CREDIT", reason: "ADJUSTMENT", amount: paise, balanceAfter: u.walletBalance, note: "test fixture" } });
};

async function makeSeller() {
  const s = await register("Seller Person");
  const r = await s.post("/api/seller/onboard", { storeName: `Store ${uid()}`, legalName: "Seller Person", panLast4: "12AB", payoutUpi: "seller@okaxis", agree: true });
  expect(r.status).toBe(201);
  const u = await tdb.user.findUniqueOrThrow({ where: { email: s.email } });
  expect((await admin.patch(`/api/admin/sellers/${u.id}`, { action: "verify" })).status).toBe(200);
  return Object.assign(s, { id: u.id });
}

const listing = (over: Record<string, unknown> = {}) => ({
  title: `Test Skin ${uid()}`, description: "A test weapon skin delivered via official in-game gift.", categoryId: weaponCat, game: "BOTH",
  rarity: "EPIC", features: ["Kill Effect"], deliveryMethod: "IN_GAME_GIFT", price: 1000, stock: 2,
  media: [{ url: "/art/rifle-1.svg", type: "IMAGE" }], complianceAck: true, ...over,
});

async function liveProduct(seller: Client, over: Record<string, unknown> = {}) {
  const r = await seller.post("/api/products", listing(over));
  expect(r.status, JSON.stringify(r.json)).toBe(201);
  expect((await admin.patch(`/api/admin/products/${r.data.id}`, { action: "approve" })).status).toBe(200);
  return r.data as { id: string; slug: string };
}

beforeAll(async () => {
  await rzp.start(4010);
  admin = await login("admin@pubgstore.dev", "Admin@12345");
  weaponCat = (await tdb.category.findUniqueOrThrow({ where: { slug: "weapon-skins" } })).id;
  await admin.put("/api/admin/settings", { commissionPercent: 10, autoCompleteDays: 3 });
});
afterAll(async () => {
  await admin.put("/api/admin/settings", { commissionPercent: 10, autoCompleteDays: 3 });
  await rzp.stop();
  await tdb.$disconnect();
});

describe("auth & sessions", () => {
  it("validates registration with field-level errors", async () => {
    const r = await new Client().post("/api/auth/register", { name: "x", email: "bad", password: "short", acceptTerms: false });
    expect(r.status).toBe(422);
    expect(Object.keys(r.json!.fields!)).toEqual(expect.arrayContaining(["name", "email", "password", "acceptTerms"]));
  });
  it("rejects duplicate emails and wrong passwords, and stores only a hashed session token", async () => {
    const c = await register();
    expect((await new Client().post("/api/auth/register", { name: "Dup", email: c.email, password: "Passw0rd!", acceptTerms: true })).status).toBe(409);
    expect((await new Client().post("/api/auth/login", { email: c.email, password: "Wrong123!" })).status).toBe(401);
    const token = c.cookie.split("=")[1];
    expect(await tdb.session.findFirst({ where: { tokenHash: token } })).toBeNull();
    expect((await c.get("/api/auth/me")).data.email).toBe(c.email);
  });
  it("logout invalidates the session server-side", async () => {
    const c = await register();
    const old = c.cookie;
    await c.post("/api/auth/logout");
    const replay = new Client();
    replay.cookie = old;
    expect((await replay.get("/api/auth/me")).data).toBeNull();
  });
  it("blocks cross-site state-changing requests", async () => {
    const c = await register();
    const r = await c.post("/api/cart", { productId: "x" }, { origin: "https://evil.example" });
    expect(r.status).toBe(403);
  });
});

describe("role-based access", () => {
  it("protects admin APIs and seller-only actions", async () => {
    const buyer = await register();
    expect((await new Client().get("/api/cart")).status).toBe(401);
    expect((await buyer.put("/api/admin/settings", { commissionPercent: 0, autoCompleteDays: 1 })).status).toBe(403);
    expect((await buyer.patch("/api/admin/products/x", { action: "approve" })).status).toBe(403);
    expect((await buyer.post("/api/products", listing())).status).toBe(403); // not a verified seller
  });
  it("prevents sellers editing someone else's listing", async () => {
    const a = await makeSeller();
    const b = await makeSeller();
    const p = await liveProduct(a);
    expect((await b.patch(`/api/products/${p.id}`, listing())).status).toBe(403);
  });
});

describe("listings & moderation", () => {
  it("rejects account-selling, credential requests and foreign media", async () => {
    const s = await makeSeller();
    expect((await s.post("/api/products", listing({ description: "Selling my account, will share password after payment" }))).status).toBe(400);
    expect((await s.post("/api/products", listing({ media: [{ url: "https://evil.example/x.png", type: "IMAGE" }] }))).status).toBe(400);
    const uc = await tdb.category.findUniqueOrThrow({ where: { slug: "uc-topup" } });
    expect((await s.post("/api/products", listing({ categoryId: uc.id }))).status).toBe(400);
  });
  it("keeps pending listings out of the marketplace until approved", async () => {
    const s = await makeSeller();
    const title = `Pending Skin ${uid()}`;
    const r = await s.post("/api/products", listing({ title }));
    expect(r.data.status).toBe("PENDING");
    const search = async () => (await new Client().get(`/api/products?q=${encodeURIComponent(title)}`)).data.total;
    expect(await search()).toBe(0);
    expect((await admin.patch(`/api/admin/products/${r.data.id}`, { action: "reject" })).status).toBe(400); // reason required
    await admin.patch(`/api/admin/products/${r.data.id}`, { action: "approve" });
    expect(await search()).toBe(1);
    // Editing sends it back to review.
    await s.patch(`/api/products/${r.data.id}`, listing({ title }));
    expect(await search()).toBe(0);
  });
});

describe("wallet checkout, fulfilment and escrow", () => {
  it("runs the full buy → deliver → confirm → payout flow with correct commission", async () => {
    const seller = await makeSeller();
    const p = await liveProduct(seller, { price: 2499, stock: 2 });
    const buyer = await register();
    await fund(buyer.email, 300_000);

    const r = await buyer.post("/api/checkout", { provider: "WALLET", gamePlayerId: "5123456789", game: "BGMI", productId: p.id });
    expect(r.status).toBe(201);
    expect(r.data.kind).toBe("paid");
    expect(await balance(buyer.email)).toBe(300_000 - 249_900);
    const order = await tdb.order.findUniqueOrThrow({ where: { orderNumber: r.data.orderNumber }, include: { items: true } });
    expect(order.status).toBe("PAID");
    expect(order.items[0]).toMatchObject({ status: "PROCESSING", commission: 24_990, sellerEarning: 224_910 });
    expect((await tdb.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(1);

    const item = order.items[0].id;
    expect((await buyer.post(`/api/order-items/${item}/deliver`, { deliveryNote: "fake delivery" })).status).toBe(403);
    expect((await buyer.post(`/api/order-items/${item}/complete`)).status).toBe(409); // not delivered yet
    expect((await seller.post(`/api/order-items/${item}/deliver`, { deliveryNote: "Gift sent 18:40 IST" })).status).toBe(200);

    const sellerBefore = await balance(seller.email);
    expect((await buyer.post(`/api/order-items/${item}/complete`)).status).toBe(200);
    expect(await balance(seller.email)).toBe(sellerBefore + 224_910);
    expect((await buyer.post(`/api/order-items/${item}/complete`)).status).toBe(409); // no double payout
    expect(await balance(seller.email)).toBe(sellerBefore + 224_910);
    expect((await tdb.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("COMPLETED");

    expect((await buyer.post("/api/reviews", { orderItemId: item, rating: 4 })).status).toBe(201);
    expect((await buyer.post("/api/reviews", { orderItemId: item, rating: 5 })).status).toBe(409);
    expect((await tdb.sellerProfile.findUniqueOrThrow({ where: { userId: seller.id } })).ratingAvg).toBe(4);
  });

  it("rolls back stock and money when the wallet balance is insufficient", async () => {
    const seller = await makeSeller();
    const p = await liveProduct(seller, { price: 5000, stock: 1 });
    const buyer = await register();
    await fund(buyer.email, 1000);
    const r = await buyer.post("/api/checkout", { provider: "WALLET", gamePlayerId: "5123456789", game: "BGMI", productId: p.id });
    expect(r.status).toBe(402);
    expect((await tdb.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(1);
    expect(await balance(buyer.email)).toBe(1000);
    expect(await tdb.order.count({ where: { buyer: { email: buyer.email } } })).toBe(0);
  });

  it("never oversells the last unit under concurrent checkouts", async () => {
    const seller = await makeSeller();
    const p = await liveProduct(seller, { price: 100, stock: 1 });
    const buyers = await Promise.all([register(), register(), register(), register()]);
    for (const b of buyers) await fund(b.email, 100_000);
    const results = await Promise.all(buyers.map((b) => b.post("/api/checkout", { provider: "WALLET", gamePlayerId: "5123456789", game: "BGMI", productId: p.id })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect((await tdb.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(0);
    const charged = await Promise.all(buyers.map((b) => balance(b.email)));
    expect(charged.filter((b) => b === 100_000 - 10_000)).toHaveLength(1);
  });

  it("enforces game compatibility and blocks buying your own listing", async () => {
    const seller = await makeSeller();
    const p = await liveProduct(seller, { game: "PUBG_MOBILE" });
    const buyer = await register();
    await fund(buyer.email, 500_000);
    expect((await buyer.post("/api/checkout", { provider: "WALLET", gamePlayerId: "5123456789", game: "BGMI", productId: p.id })).status).toBe(400);
    await fund(seller.email, 500_000);
    expect((await seller.post("/api/checkout", { provider: "WALLET", gamePlayerId: "5123456789", game: "PUBG_MOBILE", productId: p.id })).status).toBe(400);
  });

  it("applies admin commission changes to new orders only", async () => {
    const seller = await makeSeller();
    const p = await liveProduct(seller, { price: 1000, stock: 5 });
    const buyer = await register();
    await fund(buyer.email, 1_000_000);
    expect((await admin.put("/api/admin/settings", { commissionPercent: 15, autoCompleteDays: 3 })).status).toBe(200);
    const r = await buyer.post("/api/checkout", { provider: "WALLET", gamePlayerId: "5123456789", game: "BGMI", productId: p.id });
    const item = await tdb.orderItem.findFirstOrThrow({ where: { order: { orderNumber: r.data.orderNumber } } });
    expect(item).toMatchObject({ commissionRateBps: 1500, commission: 15_000, sellerEarning: 85_000 });
    await admin.put("/api/admin/settings", { commissionPercent: 10, autoCompleteDays: 3 });
    const audit = await tdb.auditLog.findFirst({ where: { action: "admin.settings.update" }, orderBy: { createdAt: "desc" } });
    expect(audit).not.toBeNull();
  });
});

describe("refunds & withdrawals", () => {
  it("refunds a wallet purchase back to the buyer after admin approval", async () => {
    const seller = await makeSeller();
    const p = await liveProduct(seller, { price: 700 });
    const buyer = await register();
    await fund(buyer.email, 100_000);
    const r = await buyer.post("/api/checkout", { provider: "WALLET", gamePlayerId: "5123456789", game: "BGMI", productId: p.id });
    const item = await tdb.orderItem.findFirstOrThrow({ where: { order: { orderNumber: r.data.orderNumber } } });
    expect((await buyer.post("/api/refunds", { orderItemId: item.id, reason: "short" })).status).toBe(422);
    const ref = await buyer.post("/api/refunds", { orderItemId: item.id, reason: "Gift never arrived after 24 hours" });
    expect(ref.status).toBe(201);
    expect((await buyer.post("/api/refunds", { orderItemId: item.id, reason: "Gift never arrived after 24 hours" })).status).toBe(409);
    expect((await admin.patch(`/api/admin/refunds/${ref.data.id}`, { approve: true })).status).toBe(200);
    expect((await admin.patch(`/api/admin/refunds/${ref.data.id}`, { approve: true })).status).toBe(409);
    expect(await balance(buyer.email)).toBe(100_000);
    const order = await tdb.order.findUniqueOrThrow({ where: { orderNumber: r.data.orderNumber }, include: { items: true } });
    expect(order.status).toBe("REFUNDED");
    expect(order.items[0].earningCredited).toBe(false);
  });

  it("holds withdrawal funds and returns them on rejection", async () => {
    const seller = await makeSeller();
    await fund(seller.email, 50_000);
    expect((await seller.post("/api/wallet/withdraw", { amount: 1000, upiId: "seller@okaxis" })).status).toBe(402);
    expect((await seller.post("/api/wallet/withdraw", { amount: 50, upiId: "seller@okaxis" })).status).toBe(422);
    const w = await seller.post("/api/wallet/withdraw", { amount: 300, upiId: "seller@okaxis" });
    expect(w.status).toBe(201);
    expect(await balance(seller.email)).toBe(20_000);
    expect((await admin.patch(`/api/admin/withdrawals/${w.data.id}`, { action: "paid" })).status).toBe(400); // UTR required
    expect((await admin.patch(`/api/admin/withdrawals/${w.data.id}`, { action: "reject", note: "UPI mismatch" })).status).toBe(200);
    expect(await balance(seller.email)).toBe(50_000);
    const buyer = await register();
    expect((await buyer.post("/api/wallet/withdraw", { amount: 100, upiId: "b@okaxis" })).status).toBe(403);
  });
});

describe("razorpay payments (mock gateway)", () => {
  async function startOrder() {
    const seller = await makeSeller();
    const p = await liveProduct(seller, { price: 1500 });
    const buyer = await register();
    const r = await buyer.post("/api/checkout", { provider: "RAZORPAY", gamePlayerId: "5123456789", game: "BGMI", productId: p.id });
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    expect(r.data).toMatchObject({ kind: "razorpay", amount: 150_000, currency: "INR" });
    expect(JSON.stringify(r.data)).not.toContain(KEY_SECRET);
    return { buyer, seller, p, ...r.data } as { buyer: Client; razorpayOrderId: string; orderNumber: string };
  }
  const status = async (orderNumber: string) => (await tdb.order.findUniqueOrThrow({ where: { orderNumber } })).status;

  it("does not mark an order paid on a forged signature", async () => {
    const o = await startOrder();
    const pay = rzp.pay(o.razorpayOrderId);
    const r = await o.buyer.post("/api/payments/razorpay/verify", { razorpay_order_id: o.razorpayOrderId, razorpay_payment_id: pay.id, razorpay_signature: "deadbeef" });
    expect(r.status).toBe(400);
    expect(await status(o.orderNumber)).toBe("PENDING_PAYMENT");
  });

  it("re-checks the gateway: a validly signed but failed payment is not accepted", async () => {
    const o = await startOrder();
    const pay = rzp.pay(o.razorpayOrderId, "failed");
    const r = await o.buyer.post("/api/payments/razorpay/verify", { razorpay_order_id: o.razorpayOrderId, razorpay_payment_id: pay.id, razorpay_signature: sig(`${o.razorpayOrderId}|${pay.id}`, KEY_SECRET) });
    expect(r.status).toBe(402);
    expect(await status(o.orderNumber)).toBe("PENDING_PAYMENT");
  });

  it("rejects an amount mismatch", async () => {
    const o = await startOrder();
    const pay = rzp.pay(o.razorpayOrderId, "captured", 100);
    const r = await o.buyer.post("/api/payments/razorpay/verify", { razorpay_order_id: o.razorpayOrderId, razorpay_payment_id: pay.id, razorpay_signature: sig(`${o.razorpayOrderId}|${pay.id}`, KEY_SECRET) });
    expect(r.status).toBe(400);
    expect(await status(o.orderNumber)).toBe("PENDING_PAYMENT");
  });

  it("only the buyer can verify their payment", async () => {
    const o = await startOrder();
    const pay = rzp.pay(o.razorpayOrderId);
    const other = await register();
    const r = await other.post("/api/payments/razorpay/verify", { razorpay_order_id: o.razorpayOrderId, razorpay_payment_id: pay.id, razorpay_signature: sig(`${o.razorpayOrderId}|${pay.id}`, KEY_SECRET) });
    expect(r.status).toBe(404);
  });

  it("marks the order paid after verified signature + captured payment, idempotently", async () => {
    const o = await startOrder();
    const pay = rzp.pay(o.razorpayOrderId, "authorized"); // server must capture it
    const body = { razorpay_order_id: o.razorpayOrderId, razorpay_payment_id: pay.id, razorpay_signature: sig(`${o.razorpayOrderId}|${pay.id}`, KEY_SECRET) };
    expect((await o.buyer.post("/api/payments/razorpay/verify", body)).status).toBe(200);
    expect((await o.buyer.post("/api/payments/razorpay/verify", body)).status).toBe(200);
    expect(await status(o.orderNumber)).toBe("PAID");
    const payment = await tdb.payment.findUniqueOrThrow({ where: { razorpayOrderId: o.razorpayOrderId } });
    expect(payment).toMatchObject({ status: "CAPTURED", razorpayPaymentId: pay.id });
  });

  it("webhook: rejects bad signatures, confirms payment, and is safe to replay", async () => {
    const o = await startOrder();
    const pay = rzp.pay(o.razorpayOrderId);
    const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: pay.id, order_id: o.razorpayOrderId } } } });
    const hook = new Client();
    expect((await hook.post("/api/payments/razorpay/webhook", raw, { "x-razorpay-signature": sig(raw, "wrong") })).status).toBe(401);
    expect(await status(o.orderNumber)).toBe("PENDING_PAYMENT");
    expect((await hook.post("/api/payments/razorpay/webhook", raw, { "x-razorpay-signature": sig(raw, WEBHOOK_SECRET) })).status).toBe(200);
    expect((await hook.post("/api/payments/razorpay/webhook", raw, { "x-razorpay-signature": sig(raw, WEBHOOK_SECRET) })).status).toBe(200);
    expect(await status(o.orderNumber)).toBe("PAID");
    const items = await tdb.orderItem.findMany({ where: { order: { orderNumber: o.orderNumber } } });
    expect(items.every((i) => i.status === "PROCESSING")).toBe(true);
    const p = await tdb.product.findUniqueOrThrow({ where: { id: items[0].productId } });
    expect(p.salesCount).toBe(1); // replay didn't double count
  });

  it("refunds Razorpay purchases to the original payment method", async () => {
    const o = await startOrder();
    const pay = rzp.pay(o.razorpayOrderId);
    await o.buyer.post("/api/payments/razorpay/verify", { razorpay_order_id: o.razorpayOrderId, razorpay_payment_id: pay.id, razorpay_signature: sig(`${o.razorpayOrderId}|${pay.id}`, KEY_SECRET) });
    const item = await tdb.orderItem.findFirstOrThrow({ where: { order: { orderNumber: o.orderNumber } } });
    const ref = await o.buyer.post("/api/refunds", { orderItemId: item.id, reason: "Seller never delivered the gift" });
    expect((await admin.patch(`/api/admin/refunds/${ref.data.id}`, { approve: true })).status).toBe(200);
    const saved = await tdb.refund.findUniqueOrThrow({ where: { id: ref.data.id } });
    expect(saved).toMatchObject({ status: "PROCESSED", destination: "ORIGINAL" });
    expect(rzp.refunds.find((r) => r.payment_id === pay.id)?.amount).toBe(150_000);
  });

  it("tops up the wallet only after verified payment", async () => {
    const buyer = await register();
    const t = await buyer.post("/api/wallet/topup", { amount: 500 });
    expect(t.status).toBe(201);
    expect(await balance(buyer.email)).toBe(0);
    const pay = rzp.pay(t.data.razorpayOrderId);
    expect((await buyer.post("/api/payments/razorpay/verify", { razorpay_order_id: t.data.razorpayOrderId, razorpay_payment_id: pay.id, razorpay_signature: sig(`${t.data.razorpayOrderId}|${pay.id}`, KEY_SECRET) })).status).toBe(200);
    expect(await balance(buyer.email)).toBe(50_000);
  });
});

describe("coupons, UC nickname & admin promotions", () => {
  it("applies a coupon: discount is funded by the platform, seller earning unchanged, usage limited per user", async () => {
    const code = `T${uid()}`.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
    expect((await admin.post("/api/admin/coupons", { code, type: "PERCENT", value: 10, minOrder: 100, maxDiscount: 150, perUserLimit: 1 })).status).toBe(201);
    const seller = await makeSeller();
    const p = await liveProduct(seller, { price: 2000, stock: 3 });
    const buyer = await register();
    await fund(buyer.email, 1_000_000);

    const pre = await buyer.post("/api/coupons/validate", { code: code.toLowerCase(), productId: p.id });
    expect(pre.status).toBe(200);
    expect(pre.data.discount).toBe(15_000); // 10% of ₹2000 capped at ₹150
    expect((await buyer.post("/api/coupons/validate", { code: "NOPE-NOPE", productId: p.id })).json?.fields?.couponCode).toBeTruthy();

    const r = await buyer.post("/api/checkout", { provider: "WALLET", gamePlayerId: "5123456789", game: "BGMI", productId: p.id, couponCode: code });
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    expect(await balance(buyer.email)).toBe(1_000_000 - 185_000);
    const order = await tdb.order.findUniqueOrThrow({ where: { orderNumber: r.data.orderNumber }, include: { items: true } });
    expect(order).toMatchObject({ subtotal: 200_000, discount: 15_000, total: 185_000, couponCode: code });
    expect(order.items[0]).toMatchObject({ discount: 15_000, sellerEarning: 180_000 });
    expect((await tdb.coupon.findUniqueOrThrow({ where: { code } })).usedCount).toBe(1);

    const again = await buyer.post("/api/checkout", { provider: "WALLET", gamePlayerId: "5123456789", game: "BGMI", productId: p.id, couponCode: code });
    expect(again.status).toBe(400);
    expect(await balance(buyer.email)).toBe(1_000_000 - 185_000);
  });

  it("releases a coupon when an unpaid Razorpay order is cancelled", async () => {
    const code = `R${uid()}`.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
    await admin.post("/api/admin/coupons", { code, type: "FLAT", value: 50, perUserLimit: 1 });
    const seller = await makeSeller();
    const p = await liveProduct(seller, { price: 500, stock: 2 });
    const buyer = await register();
    const r = await buyer.post("/api/checkout", { provider: "RAZORPAY", gamePlayerId: "5123456789", game: "BGMI", productId: p.id, couponCode: code });
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    expect(r.data.amount).toBe(45_000);
    expect((await tdb.coupon.findUniqueOrThrow({ where: { code } })).usedCount).toBe(1);
    // Let the payment window lapse, then run the scheduled expiry.
    await tdb.order.update({ where: { orderNumber: r.data.orderNumber }, data: { createdAt: new Date(Date.now() - 2 * 3_600_000) } });
    const cron = await new Client().req("GET", "/api/cron/maintenance", undefined, { authorization: `Bearer ${process.env.CRON_SECRET ?? "test-cron-secret"}` });
    expect(cron.status).toBe(200);
    expect((await tdb.order.findUniqueOrThrow({ where: { orderNumber: r.data.orderNumber } })).status).toBe("CANCELLED");
    expect((await tdb.coupon.findUniqueOrThrow({ where: { code } })).usedCount).toBe(0);
    expect(await tdb.couponRedemption.count({ where: { coupon: { code } } })).toBe(0);
  });

  it("requires an in-game nickname for UC top-ups and stores it on the order", async () => {
    const pack = await tdb.product.findFirstOrThrow({ where: { isOfficialStore: true, status: "APPROVED" }, orderBy: { price: "asc" } });
    const buyer = await register();
    await fund(buyer.email, pack.price);
    const missing = await buyer.post("/api/checkout", { provider: "WALLET", gamePlayerId: "5123456789", game: "BGMI", productId: pack.id });
    expect(missing.status).toBe(400);
    expect(missing.json?.fields?.gameNickname).toBeTruthy();
    const ok = await buyer.post("/api/checkout", { provider: "WALLET", gamePlayerId: "5123456789", game: "BGMI", productId: pack.id, gameNickname: "DragonSlayer" });
    expect(ok.status, JSON.stringify(ok.json)).toBe(201);
    expect((await tdb.order.findUniqueOrThrow({ where: { orderNumber: ok.data.orderNumber } })).gameNickname).toBe("DragonSlayer");
  });

  it("admin PATCH only changes the fields sent (defaults don't overwrite)", async () => {
    const slug = `cat-${uid()}`.toLowerCase().replace(/[^a-z0-9-]/g, "");
    const c = await admin.post("/api/admin/categories", { name: "Test Cat", slug, sortOrder: 42, isSkin: true });
    expect(c.status, JSON.stringify(c.json)).toBe(201);
    expect((await admin.patch(`/api/admin/categories/${c.data.id}`, { name: "Renamed" })).status).toBe(200);
    expect(await tdb.category.findUniqueOrThrow({ where: { slug } })).toMatchObject({ name: "Renamed", sortOrder: 42 });
    const camp = await admin.post("/api/admin/campaigns", { name: "Test", title: "Test Campaign", kicker: "Kick", endsAt: new Date(Date.now() + 86_400_000).toISOString() });
    expect(camp.status, JSON.stringify(camp.json)).toBe(201);
    expect((await admin.patch(`/api/admin/campaigns/${camp.data.id}`, { isActive: false })).status).toBe(200);
    expect(await tdb.campaign.findUniqueOrThrow({ where: { id: camp.data.id } })).toMatchObject({ kicker: "Kick", isActive: false });
    expect((await admin.post("/api/admin/campaigns", { name: "Bad one", title: "Bad", heroLeft: "https://evil.example/x.png" })).status).toBe(400);
    await admin.del(`/api/admin/campaigns/${camp.data.id}`);
    await admin.del(`/api/admin/categories/${c.data.id}`);
  });
});

describe("cron maintenance", () => {
  it("requires the cron secret", async () => {
    expect((await new Client().get("/api/cron/maintenance")).status).toBe(401);
    const r = await new Client().req("GET", "/api/cron/maintenance", undefined, { authorization: `Bearer ${process.env.CRON_SECRET ?? "test-cron-secret"}` });
    expect(r.status).toBe(200);
  });
});
