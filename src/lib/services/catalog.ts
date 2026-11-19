import "server-only";
import { db } from "../db";
import type { Prisma } from "@/generated/prisma/client";
import type { Game, Rarity } from "@/generated/prisma/enums";
import type { SortValue } from "../constants";

export const productCardSelect = {
  id: true,
  slug: true,
  title: true,
  price: true,
  compareAtPrice: true,
  rarity: true,
  level: true,
  maxLevel: true,
  game: true,
  stock: true,
  isOfficialStore: true,
  ucAmount: true,
  salesCount: true,
  category: { select: { name: true, slug: true } },
  media: { where: { type: "IMAGE" }, orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true } },
  seller: { select: { id: true, name: true, seller: { select: { storeName: true, status: true, ratingAvg: true } } } },
} satisfies Prisma.ProductSelect;

export type ProductCardData = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

export type ListFilters = {
  q?: string;
  category?: string;
  rarity?: Rarity[];
  game?: Game;
  minPrice?: number; // paise
  maxPrice?: number; // paise
  minLevel?: number;
  sort?: SortValue;
  page?: number;
  pageSize?: number;
  skinsOnly?: boolean;
  sellerId?: string;
  officialOnly?: boolean;
};

const ORDER_BY: Record<SortValue, Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ approvedAt: "desc" }, { createdAt: "desc" }],
  popular: [{ salesCount: "desc" }, { wishlistCount: "desc" }, { views: "desc" }],
  price_asc: [{ price: "asc" }],
  price_desc: [{ price: "desc" }],
};

export function buildWhere(f: ListFilters): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { status: "APPROVED", stock: { gt: 0 } };
  const and: Prisma.ProductWhereInput[] = [];
  if (f.q) {
    and.push({
      OR: [
        { title: { contains: f.q, mode: "insensitive" } },
        { description: { contains: f.q, mode: "insensitive" } },
        { category: { name: { contains: f.q, mode: "insensitive" } } },
      ],
    });
  }
  if (f.category) and.push({ category: { slug: f.category } });
  if (f.skinsOnly) and.push({ category: { isSkin: true } });
  if (f.rarity?.length) and.push({ rarity: { in: f.rarity } });
  // A BGMI buyer can use BGMI-only and cross-game items.
  if (f.game) and.push({ game: { in: f.game === "BOTH" ? ["BOTH"] : [f.game, "BOTH"] } });
  if (f.minPrice != null) and.push({ price: { gte: f.minPrice } });
  if (f.maxPrice != null) and.push({ price: { lte: f.maxPrice } });
  if (f.minLevel != null) and.push({ level: { gte: f.minLevel } });
  if (f.sellerId) and.push({ sellerId: f.sellerId });
  if (f.officialOnly != null) and.push({ isOfficialStore: f.officialOnly });
  if (and.length) where.AND = and;
  return where;
}

export async function listProducts(f: ListFilters) {
  const pageSize = Math.min(Math.max(f.pageSize ?? 12, 1), 48);
  const page = Math.max(f.page ?? 1, 1);
  const where = buildWhere(f);
  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: ORDER_BY[f.sort ?? "newest"] ?? ORDER_BY.newest,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: productCardSelect,
    }),
    db.product.count({ where }),
  ]);
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Parses URLSearchParams-like input into typed filters (used by pages and the API). */
export function parseFilters(sp: Record<string, string | string[] | undefined>): ListFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined))?.trim() || undefined;
  const num = (k: string) => {
    const v = one(k);
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const rarities = ["COMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC"] as const;
  const rarityRaw = one("rarity");
  const rarity = rarityRaw?.split(",").filter((r): r is Rarity => (rarities as readonly string[]).includes(r));
  const gameRaw = one("game");
  const sortRaw = one("sort");
  const minPrice = num("min");
  const maxPrice = num("max");
  return {
    q: one("q")?.slice(0, 80),
    category: one("category"),
    rarity: rarity?.length ? rarity : undefined,
    game: gameRaw === "PUBG_MOBILE" || gameRaw === "BGMI" ? gameRaw : undefined,
    minPrice: minPrice != null ? Math.round(minPrice * 100) : undefined,
    maxPrice: maxPrice != null ? Math.round(maxPrice * 100) : undefined,
    minLevel: num("level"),
    sort: (["newest", "popular", "price_asc", "price_desc"] as const).find((s) => s === sortRaw) ?? "newest",
    page: num("page") ? Math.floor(num("page")!) : 1,
  };
}

export async function getProductBySlug(slug: string) {
  return db.product.findUnique({
    where: { slug },
    include: {
      category: true,
      media: { orderBy: { sortOrder: "asc" } },
      seller: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          createdAt: true,
          seller: { select: { storeName: true, status: true, ratingAvg: true, ratingCount: true, totalSales: true, bio: true } },
        },
      },
    },
  });
}

export async function relatedProducts(productId: string, categoryId: string, take = 4) {
  return db.product.findMany({
    where: { status: "APPROVED", stock: { gt: 0 }, categoryId, id: { not: productId } },
    orderBy: [{ salesCount: "desc" }, { createdAt: "desc" }],
    take,
    select: productCardSelect,
  });
}

export async function getCategories() {
  return db.category.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function getHomeData() {
  const base = { status: "APPROVED" as const, stock: { gt: 0 }, isOfficialStore: false };
  const now = new Date();
  const [campaign, bundles, outfits] = await Promise.all([
    db.campaign.findFirst({ where: { isActive: true, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, orderBy: { createdAt: "desc" } }),
    db.product.findMany({ where: { ...base, category: { slug: "bundles" } }, orderBy: { salesCount: "desc" }, take: 4, select: productCardSelect }),
    db.product.findMany({ where: { ...base, category: { slug: { in: ["outfits", "mythic-sets"] } }, rarity: { in: ["LEGENDARY", "MYTHIC"] } }, orderBy: { salesCount: "desc" }, take: 3, select: productCardSelect }),
  ]);
  const [banners, featured, trending, recent, deals, sellers, categories, ucPacks] = await Promise.all([
    db.banner.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, take: 5 }),
    db.product.findMany({ where: { ...base, isFeatured: true, rarity: { in: ["LEGENDARY", "MYTHIC"] } }, orderBy: { approvedAt: "desc" }, take: 4, select: productCardSelect }),
    db.product.findMany({ where: base, orderBy: [{ salesCount: "desc" }, { wishlistCount: "desc" }, { views: "desc" }], take: 8, select: productCardSelect }),
    db.product.findMany({ where: base, orderBy: { approvedAt: "desc" }, take: 8, select: productCardSelect }),
    db.product.findMany({ where: { ...base, compareAtPrice: { not: null } }, orderBy: { price: "asc" }, take: 8, select: productCardSelect }),
    db.sellerProfile.findMany({
      where: { status: "VERIFIED", user: { role: { not: "ADMIN" } } },
      orderBy: [{ totalSales: "desc" }, { ratingAvg: "desc" }],
      take: 6,
      select: { storeName: true, ratingAvg: true, ratingCount: true, totalSales: true, user: { select: { id: true, avatarUrl: true, _count: { select: { products: { where: { status: "APPROVED" } } } } } } },
    }),
    db.category.findMany({ where: { isSkin: true }, orderBy: { sortOrder: "asc" } }),
    db.product.findMany({ where: { status: "APPROVED", isOfficialStore: true }, orderBy: { price: "asc" }, take: 1, select: { price: true } }),
  ]);
  return { campaign, bundles, outfits, banners, featured, trending, recent, deals, sellers, categories, ucFrom: ucPacks[0]?.price ?? null };
}

export async function getSellerPublic(userId: string) {
  return db.user.findFirst({
    where: { id: userId, seller: { isNot: null } },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      createdAt: true,
      seller: true,
      reviewsGot: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, rating: true, comment: true, createdAt: true, buyer: { select: { name: true } } } },
    },
  });
}
