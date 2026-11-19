import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "../db";
import { badRequest, conflict, forbidden, notFound } from "../errors";
import { toPaise } from "../money";
import { isAllowedMediaUrl } from "../storage";
import { audit, notify } from "../audit";
import type { ProductInput } from "../validation";
import type { SessionUser } from "../auth";

export function slugify(title: string) {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "item"}-${randomBytes(3).toString("hex")}`;
}

// Text that indicates account selling or credential collection — rejected outright.
const BANNED_PATTERNS = [/\bpass(word|wd)\b/i, /\botp\b/i, /\blogin (details|credentials)\b/i, /\baccount (for sale|selling|transfer)\b/i, /\bsell(ing)? (my )?account\b/i];

function assertCompliant(input: ProductInput) {
  const text = `${input.title}\n${input.description}\n${input.features.join(" ")}`;
  if (BANNED_PATTERNS.some((re) => re.test(text))) {
    throw badRequest("Listings may not sell game accounts or mention passwords/OTPs. Only officially transferable items are allowed.", {
      description: "Remove references to accounts, passwords or OTPs",
    });
  }
  for (const m of input.media) {
    if (!isAllowedMediaUrl(m.url)) throw badRequest("Media must be uploaded through DROPZONE STORE", { media: "Invalid media URL" });
  }
}

async function assertCategory(categoryId: string) {
  const cat = await db.category.findUnique({ where: { id: categoryId } });
  if (!cat) throw badRequest("Choose a valid category", { categoryId: "Invalid category" });
  if (cat.slug === "uc-topup") throw badRequest("UC packs are sold by the official store only", { categoryId: "Not allowed" });
  return cat;
}

function toData(input: ProductInput) {
  return {
    title: input.title,
    description: input.description,
    categoryId: input.categoryId,
    game: input.game,
    rarity: input.rarity,
    level: input.level ?? null,
    maxLevel: input.maxLevel ?? null,
    features: input.features,
    deliveryMethod: input.deliveryMethod === "UC_TOPUP" ? ("IN_GAME_GIFT" as const) : input.deliveryMethod,
    price: toPaise(input.price),
    compareAtPrice: input.compareAtPrice ? toPaise(input.compareAtPrice) : null,
    stock: input.stock,
    status: input.submit ? ("PENDING" as const) : ("DRAFT" as const),
    rejectionReason: null,
  };
}

function mediaRows(input: ProductInput) {
  return input.media.map((m, i) => ({ url: m.url, type: m.type, sortOrder: i, alt: input.title }));
}

export async function createListing(user: SessionUser, input: ProductInput) {
  assertCompliant(input);
  await assertCategory(input.categoryId);
  const product = await db.product.create({
    data: { ...toData(input), slug: slugify(input.title), sellerId: user.id, media: { create: mediaRows(input) } },
  });
  await audit(user.id, "product.created", "Product", product.id, { status: product.status });
  return product;
}

export async function updateListing(user: SessionUser, productId: string, input: ProductInput) {
  const existing = await db.product.findUnique({ where: { id: productId } });
  if (!existing) throw notFound("Listing not found");
  if (existing.sellerId !== user.id && user.role !== "ADMIN") throw forbidden();
  if (existing.status === "ARCHIVED") throw conflict("Archived listings can't be edited");
  assertCompliant(input);
  await assertCategory(input.categoryId);
  // Any edit sends the listing back through moderation.
  const product = await db.$transaction(async (tx) => {
    await tx.productMedia.deleteMany({ where: { productId } });
    return tx.product.update({ where: { id: productId }, data: { ...toData(input), media: { create: mediaRows(input) } } });
  });
  await audit(user.id, "product.updated", "Product", product.id, { status: product.status });
  return product;
}

export async function archiveListing(user: SessionUser, productId: string) {
  const existing = await db.product.findUnique({ where: { id: productId } });
  if (!existing) throw notFound("Listing not found");
  if (existing.sellerId !== user.id && user.role !== "ADMIN") throw forbidden();
  await db.product.update({ where: { id: productId }, data: { status: "ARCHIVED", isFeatured: false } });
  await db.cartItem.deleteMany({ where: { productId } });
  await audit(user.id, "product.archived", "Product", productId);
}

export async function moderateListing(adminId: string, productId: string, action: "approve" | "reject" | "feature" | "unfeature", reason?: string) {
  const p = await db.product.findUnique({ where: { id: productId } });
  if (!p) throw notFound("Listing not found");
  if (action === "approve") {
    await db.product.update({ where: { id: productId }, data: { status: "APPROVED", approvedAt: new Date(), rejectionReason: null } });
    await notify(p.sellerId, "Listing approved ✅", `"${p.title}" is now live on the marketplace.`, `/product/${p.slug}`);
  } else if (action === "reject") {
    if (!reason) throw badRequest("A rejection reason is required", { reason: "Required" });
    await db.product.update({ where: { id: productId }, data: { status: "REJECTED", rejectionReason: reason, isFeatured: false } });
    await db.cartItem.deleteMany({ where: { productId } });
    await notify(p.sellerId, "Listing rejected", `"${p.title}": ${reason}`, `/sell/listings`);
  } else {
    if (action === "feature" && p.status !== "APPROVED") throw conflict("Only approved listings can be featured");
    await db.product.update({ where: { id: productId }, data: { isFeatured: action === "feature" } });
  }
  await audit(adminId, `product.${action}`, "Product", productId, reason ? { reason } : undefined);
}
