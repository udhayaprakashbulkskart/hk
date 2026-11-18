import { notFound } from "next/navigation";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ListingForm } from "@/components/forms/listing-form";
import { PageTitle } from "@/components/ui/section";

export default async function EditListingPage(props: PageProps<"/sell/listings/[id]/edit">) {
  const { id } = await props.params;
  const user = await pageUser(`/sell/listings/${id}/edit`);
  const p = await db.product.findUnique({ where: { id }, include: { media: { orderBy: { sortOrder: "asc" } } } });
  if (!p || (p.sellerId !== user.id && user.role !== "ADMIN") || p.status === "ARCHIVED" || p.isOfficialStore) notFound();
  const categories = await db.category.findMany({ where: { isSkin: true }, orderBy: { sortOrder: "asc" } });
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Edit listing" subtitle="Saving changes sends the listing back for review." />
      {p.rejectionReason && <div className="card mb-4 border-neon/40 p-4 text-sm">Rejected: <b>{p.rejectionReason}</b></div>}
      <div className="card p-5 sm:p-6">
        <ListingForm
          categories={categories}
          defaults={{
            id: p.id, title: p.title, description: p.description, categoryId: p.categoryId, game: p.game, rarity: p.rarity, level: p.level, maxLevel: p.maxLevel,
            features: p.features, deliveryMethod: p.deliveryMethod, price: p.price / 100, compareAtPrice: p.compareAtPrice ? p.compareAtPrice / 100 : null, stock: p.stock,
            media: p.media.map((m) => ({ url: m.url, type: m.type })),
          }}
        />
      </div>
    </div>
  );
}
