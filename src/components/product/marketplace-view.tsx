import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getCategories, listProducts, parseFilters } from "@/lib/services/catalog";
import { getSavedIds } from "@/lib/services/user-data";
import { MarketFilters } from "./filters";
import { ProductGrid } from "./product-card";
import { EmptyState, GridSkeleton } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { PageTitle } from "@/components/ui/section";

type SP = Record<string, string | string[] | undefined>;

async function Results({ sp, skinsOnly, basePath }: { sp: SP; skinsOnly: boolean; basePath: string }) {
  const user = await getCurrentUser();
  const filters = parseFilters(sp);
  const [res, saved] = await Promise.all([listProducts({ ...filters, skinsOnly, officialOnly: skinsOnly ? false : undefined }), getSavedIds(user?.id)]);
  if (!res.items.length) {
    const filtered = Boolean(filters.q || filters.rarity || filters.game || filters.minPrice != null || filters.maxPrice != null || filters.minLevel != null);
    return filtered ? (
      <EmptyState title="No items found" body="Try a different search or clear some filters." action={{ href: basePath, label: "Clear filters" }} />
    ) : (
      <EmptyState title="First drops landing soon" body="Verified sellers are getting ready. Have officially transferable skins? Be the first to list them." action={{ href: "/sell", label: "Start selling" }} />
    );
  }
  const flat = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  return (
    <>
      <p className="mb-3 text-sm text-muted">
        {res.total} item{res.total === 1 ? "" : "s"}
        {filters.q ? <> for “<span className="text-white">{filters.q}</span>”</> : null}
      </p>
      <ProductGrid items={res.items} savedIds={saved} />
      <Pagination page={res.page} pages={res.pages} basePath={basePath} params={flat} />
    </>
  );
}

export async function MarketplaceView({ searchParams, skinsOnly, title, subtitle, basePath, lockCategory = false }: { searchParams: Promise<SP>; skinsOnly: boolean; title: string; subtitle: string; basePath: string; lockCategory?: boolean }) {
  const sp = await searchParams;
  const categories = (await getCategories()).filter((c) => (skinsOnly ? c.isSkin : true));
  return (
    <div>
      <PageTitle title={title} subtitle={subtitle} />
      <div className="mb-5">
        <MarketFilters categories={categories.map((c) => ({ slug: c.slug, name: c.name }))} showCategories={!lockCategory} />
      </div>
      <Suspense key={JSON.stringify(sp)} fallback={<GridSkeleton />}>
        <Results sp={sp} skinsOnly={skinsOnly} basePath={basePath} />
      </Suspense>
    </div>
  );
}
