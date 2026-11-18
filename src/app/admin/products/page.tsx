import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { RARITY_LABEL, DELIVERY_LABEL } from "@/lib/constants";
import { ActionButton } from "@/components/forms/action-button";
import { StatusTabs, pick } from "@/components/admin/tabs";
import { StatusBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/section";

export const metadata = { title: "Listings" };
const TABS = ["PENDING", "APPROVED", "REJECTED", "DRAFT", "ARCHIVED"] as const;

export default async function AdminProducts(props: PageProps<"/admin/products">) {
  const sp = await props.searchParams;
  const status = pick(sp.status, TABS, "PENDING");
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const items = await db.product.findMany({
    where: { status, ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}) },
    orderBy: { updatedAt: status === "PENDING" ? "asc" : "desc" },
    take: 60,
    include: { media: { where: { type: "IMAGE" }, take: 1, orderBy: { sortOrder: "asc" } }, category: true, seller: { select: { email: true, seller: { select: { storeName: true, status: true } } } }, _count: { select: { reports: { where: { status: "OPEN" } } } } },
  });
  return (
    <div>
      <PageTitle title="Listings" subtitle="Approve, reject and feature products.">
        <form className="flex gap-2"><input type="hidden" name="status" value={status} /><input name="q" defaultValue={q} placeholder="Search title" className="input w-56" /></form>
      </PageTitle>
      <StatusTabs base="/admin/products" tabs={TABS} current={status} />
      {items.length === 0 ? <EmptyState title="Queue is empty" body="Nothing to review here." /> : (
        <ul className="space-y-3">
          {items.map((p) => (
            <li key={p.id} className="card flex flex-col gap-3 p-4 sm:flex-row">
              <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-xl bg-black sm:size-28">
                {p.media[0] && <Image src={p.media[0].url} alt="" fill sizes="112px" className="object-cover" unoptimized={p.media[0].url.endsWith(".svg") || p.media[0].url.startsWith("/uploads/")} />}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/product/${p.slug}`} target="_blank" className="font-semibold hover:text-neon">{p.title}</Link>
                  <StatusBadge status={p.status} /> {p.isFeatured && <span className="badge border-amber-500/40 text-amber-300">Featured</span>}
                  {p._count.reports > 0 && <span className="badge border-neon/50 text-neon-soft">{p._count.reports} reports</span>}
                </div>
                <p className="text-xs text-muted">{p.category.name} · {RARITY_LABEL[p.rarity]} · {formatINR(p.price)} · stock {p.stock} · {p.seller.seller?.storeName ?? p.seller.email} {p.seller.seller?.status !== "VERIFIED" && "(unverified)"}</p>
                <p className="text-xs text-zinc-400">Delivery: {DELIVERY_LABEL[p.deliveryMethod]}</p>
                <p className="line-clamp-2 text-sm text-zinc-300">{p.description}</p>
                {p.rejectionReason && <p className="text-xs text-neon-soft">Reason: {p.rejectionReason}</p>}
              </div>
              <div className="flex flex-wrap items-start gap-2 sm:w-44 sm:flex-col">
                {p.status !== "APPROVED" && p.status !== "ARCHIVED" && <ActionButton url={`/api/admin/products/${p.id}`} body={{ action: "approve" }} variant="primary" label="Approve" success="Listing approved" className="sm:w-full" />}
                {p.status !== "REJECTED" && p.status !== "ARCHIVED" && <ActionButton url={`/api/admin/products/${p.id}`} body={{ action: "reject" }} variant="danger" label="Reject" prompt="Reason for rejection (shown to seller):" success="Listing rejected" className="sm:w-full" />}
                {p.status === "APPROVED" && <ActionButton url={`/api/admin/products/${p.id}`} body={{ action: p.isFeatured ? "unfeature" : "feature" }} label={p.isFeatured ? "Unfeature" : "Feature"} success="Updated" className="sm:w-full" />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
