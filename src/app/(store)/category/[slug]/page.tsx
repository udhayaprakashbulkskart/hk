import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { MarketplaceView } from "@/components/product/marketplace-view";

const BLURBS: Record<string, string> = {
  "weapon-skins": "Upgradable rifles, SMGs and snipers with kill effects and premium finishes.",
  outfits: "Full outfits and mythic sets from verified sellers.",
  helmets: "Rare helmet skins to finish your look.",
  backpacks: "Backpack skins — from classic to legendary.",
  vehicles: "Vehicle skins for the drive to the next circle.",
  crates: "Crate and coupon items, where the game permits transfer.",
  bundles: "Curated bundles — several items, one price.",
};

const category = (slug: string) => db.category.findUnique({ where: { slug }, select: { slug: true, name: true, description: true, isSkin: true } });

export async function generateMetadata(props: PageProps<"/category/[slug]">): Promise<Metadata> {
  const c = await category((await props.params).slug);
  if (!c) return { title: "Category not found" };
  return { title: c.name, description: c.description ?? BLURBS[c.slug] ?? `Shop ${c.name} on ZYNOFLIX STORE.`, alternates: { canonical: `/category/${c.slug}` } };
}

export default async function CategoryPage(props: PageProps<"/category/[slug]">) {
  const { slug } = await props.params;
  const c = await category(slug);
  if (!c) notFound();
  if (!c.isSkin) redirect("/uc");
  const searchParams = props.searchParams.then((sp) => ({ ...sp, category: c.slug }));
  return <MarketplaceView searchParams={searchParams} skinsOnly basePath={`/category/${c.slug}`} title={c.name} subtitle={c.description ?? BLURBS[c.slug] ?? `Browse ${c.name}.`} lockCategory />;
}
