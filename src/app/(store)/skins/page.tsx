import type { Metadata } from "next";
import { MarketplaceView } from "@/components/product/marketplace-view";

export const metadata: Metadata = { title: "Buy Skins" };

export default function SkinsPage(props: PageProps<"/skins">) {
  return <MarketplaceView searchParams={props.searchParams} skinsOnly basePath="/skins" title="Buy Skins" subtitle="Weapon skins, outfits, mythic sets, vehicles, helmets and accessories." />;
}
