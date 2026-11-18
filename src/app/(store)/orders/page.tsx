import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { StatusBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/section";

export const metadata: Metadata = { title: "My Orders" };

export default async function OrdersPage() {
  const user = await pageUser("/orders");
  const orders = await db.order.findMany({ where: { buyerId: user.id }, orderBy: { createdAt: "desc" }, include: { items: { select: { titleSnapshot: true, status: true } } }, take: 100 });
  return (
    <div>
      <PageTitle title="My Orders" subtitle="Purchases, delivery status and receipts." />
      {orders.length === 0 ? (
        <EmptyState title="No orders yet" body="Your purchases will show up here." action={{ href: "/skins", label: "Start shopping" }} />
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.orderNumber}`} className="card-glow flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">{o.orderNumber} <StatusBadge status={o.status} /></p>
                  <p className="mt-1 truncate text-sm text-zinc-300">{o.items.map((i) => i.titleSnapshot).join(", ")}</p>
                  <p className="text-xs text-muted">{o.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {o.items.length} item{o.items.length > 1 ? "s" : ""}</p>
                </div>
                <span className="font-display text-lg font-bold">{formatINR(o.total)}</span>
                <ChevronRight className="size-5 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
