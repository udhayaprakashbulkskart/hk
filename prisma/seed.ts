/**
 * Development seed. Wipes and recreates demo data.
 *   npm run db:seed
 * Refuses to run against NODE_ENV=production unless SEED_FORCE=true.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Game, Rarity, DeliveryMethod, MediaType, WalletTxnReason } from "../src/generated/prisma/enums";

if (process.env.NODE_ENV === "production" && process.env.SEED_FORCE !== "true") {
  console.error("Refusing to seed a production database. Set SEED_FORCE=true to override.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const rs = (n: number) => n * 100; // rupees → paise
let slugN = 0;
const slug = (t: string) => `${t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${(++slugN).toString(36).padStart(3, "0")}`;

async function wipe() {
  const tables = [
    "AuditLog", "SupportTicket", "Setting", "Banner", "CouponRedemption", "Coupon", "Campaign", "Report", "Notification", "Review", "Refund", "Withdrawal",
    "WalletTransaction", "Payment", "WalletTopup", "OrderItem", "Order", "CartItem", "WishlistItem", "ProductMedia",
    "Product", "Category", "SellerProfile", "Session", "RateLimit", "User",
  ];
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t}"`).join(", ")} CASCADE`);
}

async function main() {
  await wipe();
  const pw = (p: string) => bcrypt.hashSync(p, 10);

  await db.setting.createMany({ data: [{ key: "commission_bps", value: "1000" }, { key: "auto_complete_days", value: "3" }] });

  const catData = [
    ["weapon-skins", "Weapon Skins", "crosshair", true],
    ["outfits", "Outfits", "shirt", true],
    ["mythic-sets", "Mythic Sets", "sparkles", true],
    ["helmets", "Helmets", "hard-hat", true],
    ["backpacks", "Backpacks", "backpack", true],
    ["vehicles", "Vehicle Skins", "car", true],
    ["crates", "Crates", "box", true],
    ["bundles", "Bundles", "gift", true],
    ["accessories", "Accessories", "sparkles", true],
    ["uc-topup", "UC Top-Up", "coins", false],
  ] as const;
  const cats: Record<string, string> = {};
  for (const [i, [s, name, icon, isSkin]] of catData.entries()) {
    const c = await db.category.create({ data: { slug: s, name, icon, isSkin, sortOrder: i } });
    cats[s] = c.id;
  }

  // ── Users ──
  const admin = await db.user.create({
    data: {
      email: "admin@pubgstore.dev", name: "Store Admin", passwordHash: pw("Admin@12345"), role: "ADMIN",
      seller: { create: { storeName: "DROPZONE Official", legalName: "DROPZONE Ops", status: "VERIFIED", verifiedAt: new Date(), ratingAvg: 4.9, ratingCount: 312, totalSales: 1840 } },
    },
  });
  const buyer = await db.user.create({
    data: { email: "demo@pubgstore.dev", name: "Udhayaprakash P", passwordHash: pw("Demo@12345"), gamePlayerId: "5123456789", preferredGame: "BGMI", phone: "9876543210" },
  });
  const sellerDefs = [
    ["ghost@pubgstore.dev", "Arjun Mehta", "GhostOps Armory", 4.8, "Mythic sets and upgradable guns, delivered within the hour.", 124, 86],
    ["raven@pubgstore.dev", "Priya Nair", "RavenSkins", 4.6, "Outfit collector since Season 1. Fast gifting.", 71, 58],
    ["drift@pubgstore.dev", "Kabir Singh", "DriftKing Garage", 4.7, "Vehicle skins only. Lambo, Koenigsegg & more.", 64, 49],
    ["neon@pubgstore.dev", "Sana Khan", "NeonVault", 4.5, "Rare helmets, backpacks and parachutes.", 38, 31],
  ] as const;
  const sellers = [];
  for (const [email, name, store, rating, bio, sold, reviews] of sellerDefs) {
    sellers.push(
      await db.user.create({
        data: {
          email, name, passwordHash: pw("Seller@12345"), role: "SELLER",
          seller: { create: { storeName: store, legalName: name, panLast4: "12AB", payoutUpi: `${email.split("@")[0]}@okaxis`, status: "VERIFIED", verifiedAt: new Date(), ratingAvg: rating, ratingCount: reviews, totalSales: sold, bio } },
        },
      }),
    );
  }
  await db.user.create({
    data: { email: "applicant@pubgstore.dev", name: "Rohit Das", passwordHash: pw("Seller@12345"), seller: { create: { storeName: "Rohit Lootbox", legalName: "Rohit Das", panLast4: "9XYZ", payoutUpi: "rohit@oksbi", status: "PENDING" } } },
  });

  // ── Products ──
  type P = { t: string; c: string; img: string[]; price: number; mrp?: number; r: Rarity; lvl?: [number, number]; g?: Game; f: string[]; s: number; feat?: boolean; d?: DeliveryMethod; spin?: boolean; sales?: number };
  const P: P[] = [
    { t: "Celestial M416", c: "weapon-skins", img: ["/media/skins/gun-celestial-rifle.webp"], price: 2499, mrp: 3499, r: "MYTHIC", lvl: [7, 7], f: ["Kill Effect", "On-Hit Effect", "Loot Crate", "Advanced Look"], s: 0, feat: true, sales: 42 },
    { t: "Molten AKM", c: "weapon-skins", img: ["/media/skins/gun-molten-akm.webp"], price: 1899, mrp: 2299, r: "LEGENDARY", lvl: [5, 7], f: ["Kill Message", "Custom Finish"], s: 1, sales: 28 },
    { t: "Dragonfire Groza", c: "weapon-skins", img: ["/media/skins/gun-dragonfire-smg.webp"], price: 1599, r: "LEGENDARY", lvl: [4, 7], f: ["Hit Effect"], s: 0, g: "BGMI", sales: 19 },
    { t: "Frostbite Kar98", c: "weapon-skins", img: ["/media/skins/gun-frostbite-rifle.webp"], price: 699, mrp: 899, r: "EPIC", lvl: [3, 5], f: ["Muzzle Glow"], s: 3, sales: 11 },
    { t: "Scarecrow AKM", c: "weapon-skins", img: ["/media/skins/gun-scarecrow-akm.webp"], price: 849, r: "EPIC", lvl: [2, 5], f: ["Custom Finish"], s: 0, sales: 7 },
    { t: "Sunfire UMP45", c: "weapon-skins", img: ["smg-3"], price: 549, r: "RARE", f: ["Finish only"], s: 3, g: "PUBG_MOBILE", sales: 3 },
    { t: "Abyssal Dragon Set", c: "mythic-sets", img: ["/media/skins/outfit-abyssal-dragon.webp", "/media/skins/outfit-trident-warden.webp"], price: 5999, mrp: 6999, r: "MYTHIC", lvl: [6, 6], f: ["Full Set", "Emote", "Glide Trail"], s: 0, feat: true, sales: 37 },
    { t: "Raven Knight Set", c: "mythic-sets", img: ["/media/skins/outfit-raven-knight.webp"], price: 4299, r: "MYTHIC", f: ["Full Set", "Mask"], s: 1, feat: true, sales: 25 },
    { t: "Pharaoh Gold X-Suit", c: "mythic-sets", img: ["/media/skins/outfit-pharaoh-gold.webp"], price: 6499, mrp: 7999, r: "MYTHIC", lvl: [5, 6], f: ["Upgradable", "Exclusive Voice Pack"], s: 0, sales: 31 },
    { t: "Golden Seraph Set", c: "mythic-sets", img: ["/media/skins/outfit-golden-seraph.webp"], price: 4899, r: "MYTHIC", f: ["Full Set", "Parachute"], s: 1, g: "BGMI", sales: 14 },
    { t: "Crimson Gambler Outfit", c: "outfits", img: ["/media/skins/outfit-crimson-gambler.webp"], price: 1299, mrp: 1599, r: "LEGENDARY", f: ["Top", "Pants", "Mask"], s: 1, sales: 18 },
    { t: "Blossom Empress Outfit", c: "outfits", img: ["/media/skins/outfit-blossom-empress.webp"], price: 2199, r: "LEGENDARY", f: ["Full outfit"], s: 1, sales: 9 },
    { t: "Skull Rider Outfit", c: "outfits", img: ["/media/skins/outfit-skull-rider.webp"], price: 899, r: "EPIC", f: ["Top", "Pants"], s: 1, sales: 6 },
    { t: "Signed Mummy Suit", c: "outfits", img: ["/media/skins/outfit-signed-mummy.webp"], price: 749, mrp: 999, r: "EPIC", f: ["Full outfit"], s: 1, sales: 4 },
    { t: "Lamborghini Urus Skin", c: "vehicles", img: ["car-2", "car-3"], price: 3999, r: "LEGENDARY", f: ["UAZ Skin", "Custom Horn"], s: 2, feat: true, sales: 22 },
    { t: "Neon Sports Car Skin", c: "vehicles", img: ["car-1"], price: 3499, mrp: 3999, r: "LEGENDARY", f: ["Dacia Skin", "Neon Underglow"], s: 2, sales: 16 },
    { t: "Koenigsegg Jesko Skin", c: "vehicles", img: ["car-4"], price: 5499, r: "MYTHIC", f: ["Coupe RB Skin", "Unique Exhaust"], s: 2, sales: 12 },
    { t: "Desert Storm Buggy", c: "vehicles", img: ["buggy-1"], price: 999, r: "EPIC", f: ["Buggy Skin"], s: 2, sales: 5 },
    { t: "Toxic Buggy", c: "vehicles", img: ["buggy-2"], price: 799, mrp: 999, r: "RARE", f: ["Buggy Skin"], s: 2, g: "PUBG_MOBILE", sales: 2 },
    { t: "Crimson Lv.3 Helmet", c: "helmets", img: ["helmet-1"], price: 599, r: "EPIC", f: ["Helmet Skin"], s: 3, sales: 8 },
    { t: "Glacier Helmet", c: "helmets", img: ["helmet-2"], price: 899, mrp: 1099, r: "LEGENDARY", f: ["Helmet Skin", "Frost Effect"], s: 3, sales: 13 },
    { t: "Golden Warrior Helmet", c: "helmets", img: ["helmet-3"], price: 1199, r: "LEGENDARY", f: ["Helmet Skin"], s: 3, sales: 10 },
    { t: "Phantom Helmet", c: "helmets", img: ["helmet-4"], price: 449, r: "RARE", f: ["Helmet Skin"], s: 3, sales: 1 },
    { t: "Tactical Backpack Lv.3", c: "backpacks", img: ["backpack-1"], price: 499, r: "EPIC", f: ["Backpack Skin"], s: 3, sales: 9 },
    { t: "Frost Backpack", c: "backpacks", img: ["backpack-2"], price: 649, mrp: 799, r: "LEGENDARY", f: ["Backpack Skin"], s: 3, sales: 6 },
    { t: "Lunar Festival Bundle", c: "bundles", img: ["/media/skins/outfit-blossom-empress.webp", "/media/skins/gun-dragonfire-smg.webp"], price: 3299, mrp: 4499, r: "LEGENDARY", f: ["Outfit", "Weapon Finish", "Emote"], s: 1, feat: true, sales: 15 },
    { t: "Dragon Treasure Crate Pack", c: "crates", img: ["/media/skins/gun-molten-akm.webp"], price: 799, mrp: 999, r: "EPIC", f: ["Crate coupon x5"], s: 3, d: "REDEEM_CODE", sales: 6 },
    { t: "Royal Parachute", c: "accessories", img: ["parachute-1"], price: 399, r: "EPIC", f: ["Parachute Skin", "Trail"], s: 3, d: "REDEEM_CODE", sales: 4 },
    { t: "Sky Rider Parachute", c: "accessories", img: ["parachute-2"], price: 349, r: "RARE", f: ["Parachute Skin"], s: 3, d: "REDEEM_CODE", sales: 2 },
  ];
  const created = [];
  for (const [i, p] of P.entries()) {
    const media: { url: string; type: MediaType; sortOrder: number; alt: string }[] = p.img.map((m, k) => ({ url: m.startsWith("/") ? m : `/art/${m}.svg`, type: "IMAGE", sortOrder: k + 1, alt: p.t }));
    if (p.spin) for (let k = 0; k < 24; k++) media.push({ url: `/art/spin/rifle-${String(k).padStart(2, "0")}.svg`, type: "SPIN", sortOrder: 100 + k, alt: p.t });
    const approvedAt = new Date(Date.now() - (P.length - i) * 3_600_000 * 7);
    created.push(
      await db.product.create({
        data: {
          slug: slug(p.t),
          title: p.t,
          description: `${p.t} — ${p.f.join(", ")}. Delivered by ${p.d === "REDEEM_CODE" ? "an officially issued redeem code" : "the game's official in-game gifting feature"} to your Player ID. No account access, passwords or OTPs are ever required. Please double-check your Player ID before ordering.`,
          categoryId: cats[p.c],
          sellerId: sellers[p.s].id,
          game: p.g ?? "BOTH",
          rarity: p.r,
          level: p.lvl?.[0],
          maxLevel: p.lvl?.[1],
          features: p.f,
          deliveryMethod: p.d ?? "IN_GAME_GIFT",
          price: rs(p.price),
          compareAtPrice: p.mrp ? rs(p.mrp) : null,
          stock: 3 + (i % 6),
          status: "APPROVED",
          isFeatured: !!p.feat,
          approvedAt,
          createdAt: approvedAt,
          salesCount: p.sales ?? 0,
          views: (p.sales ?? 0) * 13 + 20,
          wishlistCount: Math.floor((p.sales ?? 0) / 2),
          media: { create: media },
        },
      }),
    );
  }

  // Pending listing for the admin moderation queue.
  await db.product.create({
    data: {
      slug: slug("Dragon Fire DP-28"), title: "Dragon Fire DP-28", categoryId: cats["weapon-skins"], sellerId: sellers[0].id, rarity: "LEGENDARY", level: 2, maxLevel: 5,
      description: "Dragon Fire DP-28 with fire tracer. Delivered via official in-game gift to your Player ID.", features: ["Fire Tracer"], price: rs(1399), stock: 2, status: "PENDING",
      media: { create: [{ url: "/art/rifle-5.svg", type: "IMAGE", sortOrder: 0 }] },
    },
  });

  // ── UC packs (official store; fulfilled via an authorised top-up channel to Player ID) ──
  const uc = [[60, 75], [325, 380], [660, 750], [1800, 1950], [3850, 3950], [8100, 7900]] as const;
  for (const [amount, price] of uc) {
    await db.product.create({
      data: {
        slug: slug(`${amount} UC`), title: `${amount.toLocaleString("en-IN")} UC`, categoryId: cats["uc-topup"], sellerId: admin.id, rarity: "COMMON", ucAmount: amount,
        description: `${amount} Unknown Cash credited to your BGMI / PUBG Mobile Player ID through an authorised top-up partner. Only your Player ID is needed — never your password or OTP.`,
        features: ["Instant", "Player ID only"], deliveryMethod: "UC_TOPUP", price: rs(price), stock: 999, status: "APPROVED", isOfficialStore: true, approvedAt: new Date(),
        media: { create: [{ url: "/art/coin-1.svg", type: "IMAGE", sortOrder: 0, alt: `${amount} UC` }] },
      },
    });
  }

  // ── Banners ──
  await db.banner.createMany({
    data: [
      { title: "Mythic Sets", subtitle: "Exclusive PUBG Mobile & BGMI outfits from verified sellers", badge: "New arrival", ctaLabel: "Shop Now", ctaHref: "/category/outfits", imageUrl: "/media/skins/outfit-golden-seraph.webp", sortOrder: 0 },
      { title: "Abyssal Sets", subtitle: "Legendary armour sets from verified sellers", badge: "Hot deals", ctaLabel: "Explore", ctaHref: "/category/outfits", imageUrl: "/media/skins/outfit-abyssal-dragon.webp", sortOrder: 1 },
      { title: "Pharaoh Gold", subtitle: "Royal mythic outfits — upgradable and rare", badge: "Limited", ctaLabel: "View mythics", ctaHref: "/category/outfits", imageUrl: "/media/skins/outfit-pharaoh-gold.webp", sortOrder: 2 },
    ],
  });

  // ── Festival campaign + coupons ──
  await db.campaign.create({
    data: {
      name: "Lunar Festival", kicker: "Limited-time festival event", title: "Lunar Festival Sale", nativeTitle: "新春",
      subtitle: "Festival bundles, legendary outfits and weapon skins at special prices.", ctaLabel: "Shop the festival", ctaHref: "/category/bundles",
      heroLeft: "/media/skins/outfit-blossom-empress.webp", heroRight: "/media/skins/outfit-golden-seraph.webp",
      endsAt: new Date(Date.now() + 10 * 86_400_000), isActive: true,
    },
  });
  await db.coupon.createMany({
    data: [
      { code: "LUNAR10", description: "10% off festival orders (max ₹500)", type: "PERCENT", value: 10, maxDiscount: rs(500), minOrder: rs(499), perUserLimit: 1 },
      { code: "WELCOME50", description: "₹50 off your first order over ₹299", type: "FLAT", value: rs(50), minOrder: rs(299), perUserLimit: 1 },
    ],
  });

  // ── Wallet + demo history for the buyer ──
  let bal = 0;
  const ledger = async (userId: string, type: "CREDIT" | "DEBIT", reason: WalletTxnReason, amount: number, reference?: string, note?: string) => {
    const u = await db.user.update({ where: { id: userId }, data: { walletBalance: { [type === "CREDIT" ? "increment" : "decrement"]: amount } } });
    if (userId === buyer.id) bal = u.walletBalance;
    await db.walletTransaction.create({ data: { userId, type, reason, amount, balanceAfter: u.walletBalance, reference, note } });
  };
  await ledger(buyer.id, "CREDIT", "ADJUSTMENT", rs(20000), "seed", "Demo wallet credit (development only)");

  // A completed past order with a review, so ratings and history aren't empty.
  const past = created[1];
  const commission = Math.round(past.price * 0.1);
  const order = await db.order.create({
    data: {
      orderNumber: "PS-DEMO-000001", buyerId: buyer.id, status: "COMPLETED", subtotal: past.price, platformFee: commission, total: past.price, provider: "WALLET",
      gamePlayerId: "5123456789", game: "BGMI", paidAt: new Date(Date.now() - 5 * 86_400_000), createdAt: new Date(Date.now() - 5 * 86_400_000),
      items: { create: { productId: past.id, sellerId: past.sellerId, titleSnapshot: past.title, unitPrice: past.price, quantity: 1, lineTotal: past.price, commissionRateBps: 1000, commission, sellerEarning: past.price - commission, status: "COMPLETED", deliveredAt: new Date(Date.now() - 4.9 * 86_400_000), completedAt: new Date(Date.now() - 4 * 86_400_000), earningCredited: true, deliveryNote: "Gift sent in-game at 21:14 IST" } },
      payments: { create: { provider: "WALLET", amount: past.price, status: "CAPTURED", method: "wallet" } },
    },
    include: { items: true },
  });
  await ledger(buyer.id, "DEBIT", "PURCHASE", past.price, order.orderNumber, `Payment for order ${order.orderNumber}`);
  await ledger(past.sellerId, "CREDIT", "SALE_EARNING", past.price - commission, order.orderNumber, `Earning for "${past.title}"`);
  await db.review.create({ data: { orderItemId: order.items[0].id, buyerId: buyer.id, sellerId: past.sellerId, rating: 5, comment: "Gift arrived in 10 minutes. Legit seller!" } });
  await db.sellerProfile.update({ where: { userId: past.sellerId }, data: { totalSales: { increment: 1 } } });

  // Seller wallet balances so withdrawals can be demoed.
  for (const s of sellers) await ledger(s.id, "CREDIT", "ADJUSTMENT", rs(5000), "seed", "Demo earnings (development only)");
  await db.withdrawal.create({ data: { userId: sellers[0].id, amount: rs(1500), upiId: "ghost@okaxis" } });
  await ledger(sellers[0].id, "DEBIT", "WITHDRAWAL", rs(1500), "seed", "Withdrawal to ghost@okaxis");

  await db.wishlistItem.createMany({ data: [created[0], created[6], created[14]].map((p) => ({ userId: buyer.id, productId: p.id })) });
  await db.notification.createMany({
    data: [
      { userId: buyer.id, title: "Welcome to PUBG Store", body: "We never ask for your game password or OTP. Only your Player ID is needed.", link: "/support" },
      { userId: buyer.id, title: "Order completed", body: "Order PS-DEMO-000001 is complete. Thanks for rating the seller!", link: "/orders/PS-DEMO-000001" },
    ],
  });
  await db.report.create({ data: { productId: created[5].id, reporterId: buyer.id, reason: "Wrong category", details: "This looks like an SMG, not a rifle." } });
  await db.supportTicket.create({ data: { userId: buyer.id, email: buyer.email, subject: "How long does gifting take?", message: "I placed an order and wanted to know how long in-game gifting usually takes." } });

  console.log(`Seeded: ${created.length} listings, 6 UC packs, ${sellers.length} sellers. Buyer wallet ₹${bal / 100}.`);
  console.log("Logins → admin@pubgstore.dev / Admin@12345 · demo@pubgstore.dev / Demo@12345 · ghost@pubgstore.dev / Seller@12345");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
