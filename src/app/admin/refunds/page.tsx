import Link from "next/link";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { ActionButton } from "@/components/forms/action-button";
import { StatusTabs, pick } from "@/components/admin/tabs";
import { StatusBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/section";

export const metadata = { title: "Refunds" };
const TABS = ["REQUESTED", "PROCESSED", "REJECTED"] as const;

export default async function AdminRefunds(props: PageProps<"/admin/refunds">) {
  const status = pick((await props.searchParams).status, TABS, "REQUESTED");
  const rows = await db.refund.findMany({ where: { status }, orderBy: { createdAt: "asc" }, take: 100, include: { order: { select: { orderNumber: true, provider: true } }, orderItem: { select: { titleSnapshot: true, deliveryNote: true, deliveredAt: true } }, requester: { select: { email: true } } } });
  return (
    <div>
      <PageTitle title="Refunds" subtitle="Approved refunds go to the original Razorpay payment where possible, otherwise to the buyer's wallet." />
      <StatusTabs base="/admin/refunds" tabs={TABS} current={status} />
      {rows.length === 0 ? <EmptyState title="No refunds here" /> : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="card space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/orders/${r.order.orderNumber}`} className="font-semibold hover:text-neon">{r.order.orderNumber}</Link>
                <StatusBadge status={r.status} />
                <span className="text-sm">{r.orderItem.titleSnapshot}</span>
                <span className="ml-auto font-semibold">{formatINR(r.amount)}</span>
              </div>
              <p className="text-sm text-zinc-300"><span className="text-muted">Buyer ({r.requester.email}):</span> {r.reason}</p>
              <p className="text-xs text-muted">Seller delivery note: {r.orderItem.deliveryNote ?? "not delivered yet"} · paid via {r.order.provider} · destination {r.destination}</p>
              {r.adminNote && <p className="text-xs text-muted">Admin note: {r.adminNote}</p>}
              {r.status === "REQUESTED" && (
                <div className="flex gap-2">
                  <ActionButton url={`/api/admin/refunds/${r.id}`} body={{ approve: true }} variant="primary" label="Approve & refund" prompt="Optional note to buyer:" promptKey="note" promptRequired={false} success="Refund processed" />
                  <ActionButton url={`/api/admin/refunds/${r.id}`} body={{ approve: false }} variant="danger" label="Decline" prompt="Reason (shown to buyer):" promptKey="note" success="Refund declined" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
