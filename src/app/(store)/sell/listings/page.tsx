import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import clsx from "clsx";
import { Pencil, Plus } from "lucide-react";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { ActionButton } from "@/components/forms/action-button";
import { StatusBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/section";

export const metadata: Metadata = { title: "My Listings" };
const TABS = ["ALL", "APPROVED", "PENDING", "DRAFT", "REJECTED", "ARCHIVED"] as const;

export default async function MyListingsPage(props: PageProps<"/sell/listings">) {
  const user = await pageUser("/sell/listings");
  const sp = await props.searchParams;
  const status = TABS.find((t) => t === sp.status) ?? "ALL";
  const items = await db.product.findMany({
    where: { sellerId: user.id, ...(status !== "ALL" ? { status } : {}) },
    orderBy: { updatedAt: "desc" },
    include: { media: { where: { type: "IMAGE" }, take: 1, orderBy: { sortOrder: "asc" } }, category: true },
  });
  return (
    <div>
      <PageTitle title="My Listings" subtitle="Manage, edit and track moderation status.">
        <Link href="/sell/new" className="btn-primary"><Plus className="size-4" /> New listing</Link>
      </PageTitle>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {TABS.map((t) => (
          <Link key={t} href={t === "ALL" ? "/sell/listings" : `/sell/listings?status=${t}`} className={clsx("chip shrink-0", status === t && "chip-active")}>{t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}</Link>
        ))}
      </div>
      {items.length === 0 ? (
        <EmptyState title="No listings here" body="Create a listing to start selling." action={{ href: "/sell/new", label: "List an item" }} />
      ) : (
        <ul className="space-y-3">
          {items.map((p) => (
            <li key={p.id} className="card flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-black">
                {p.media[0] && <Image src={p.media[0].url} alt="" fill sizes="64px" className="object-cover" unoptimized={p.media[0].url.endsWith(".svg") || p.media[0].url.startsWith("/uploads/")} />}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/product/${p.slug}`} className="font-semibold hover:text-neon">{p.title}</Link>
                <p className="text-xs text-muted">{p.category.name} · {formatINR(p.price)} · {p.stock} in stock · {p.salesCount} sold · {p.views} views</p>
                {p.rejectionReason && p.status === "REJECTED" && <p className="mt-1 text-xs text-neon-soft">Reason: {p.rejectionReason}</p>}
              </div>
              <StatusBadge status={p.status} />
              {p.status !== "ARCHIVED" && !p.isOfficialStore && (
                <div className="flex gap-2">
                  <Link href={`/sell/listings/${p.id}/edit`} className="btn-outline btn-sm"><Pencil className="size-3" /> Edit</Link>
                  <ActionButton url={`/api/products/${p.id}`} method="DELETE" label="Archive" variant="ghost" confirm="Archive this listing? It will be removed from the marketplace." success="Listing archived" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
