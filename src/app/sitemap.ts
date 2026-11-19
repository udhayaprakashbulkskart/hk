import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { SITE_URL } from "@/lib/constants";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [cats, products] = await Promise.all([
    db.category.findMany({ where: { isSkin: true }, select: { slug: true } }),
    db.product.findMany({ where: { status: "APPROVED", isOfficialStore: false }, select: { slug: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 5000 }),
  ]);
  const page = (path: string, priority = 0.5): MetadataRoute.Sitemap[number] => ({ url: `${SITE_URL}${path}`, changeFrequency: "daily", priority });
  return [
    page("/", 1),
    page("/marketplace", 0.9),
    page("/uc", 0.9),
    ...cats.map((c) => page(`/category/${c.slug}`, 0.8)),
    ...["/faq", "/contact", "/terms", "/privacy"].map((p) => page(p, 0.3)),
    ...products.map((p) => ({ url: `${SITE_URL}/product/${p.slug}`, lastModified: p.updatedAt, priority: 0.6 })),
  ];
}
