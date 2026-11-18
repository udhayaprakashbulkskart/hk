import type { Metadata } from "next";
import { MarketplaceView } from "@/components/product/marketplace-view";

export const metadata: Metadata = { title: "Gun Skins" };

/** Weapon-skin storefront: the marketplace view locked to the weapon-skins category. */
export default function GunsPage(props: PageProps<"/guns">) {
  const searchParams = props.searchParams.then((sp) => ({ ...sp, category: "weapon-skins" }));
  return <MarketplaceView searchParams={searchParams} skinsOnly basePath="/guns" title="Gun Skins" subtitle="Upgradable rifles, SMGs and snipers with kill effects and premium finishes." />;
}
