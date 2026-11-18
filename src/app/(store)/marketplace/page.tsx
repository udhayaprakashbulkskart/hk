import type { Metadata } from "next";
import { MarketplaceView } from "@/components/product/marketplace-view";

export const metadata: Metadata = { title: "Marketplace" };

export default function MarketplacePage(props: PageProps<"/marketplace">) {
  return <MarketplaceView searchParams={props.searchParams} skinsOnly={false} basePath="/marketplace" title="Marketplace" subtitle="Every approved listing from verified sellers and the official UC store." />;
}
