import type { Metadata } from "next";
import { MarketplaceView } from "@/components/product/marketplace-view";

export const metadata: Metadata = { title: "Marketplace" };

export default function MarketplacePage(props: PageProps<"/marketplace">) {
  return <MarketplaceView searchParams={props.searchParams} skinsOnly={false} basePath="/marketplace" title="All Products" subtitle="Every skin, outfit, bundle and UC pack in the store." />;
}
