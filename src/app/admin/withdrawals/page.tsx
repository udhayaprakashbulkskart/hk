import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { ActionButton } from "@/components/forms/action-button";
import { StatusTabs, pick } from "@/components/admin/tabs";
import { StatusBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/section";

export const metadata = { title: "Withdrawals" };
const TABS = ["PENDING", "APPROVED", "PAID", "REJECTED"] as const;

export default async function AdminWithdrawals(props: PageProps<"/admin/withdrawals">) {
  const status = pick((await props.searchParams).status, TABS, "PENDING");
  const rows = await db.withdrawal.findMany({ where: { status }, orderBy: { createdAt: "asc" }, take: 100, include: { user: { select: { email: true, seller: { select: { storeName: true, legalName: true } } } } } });
  return (
    <div>
      <PageTitle title="Withdrawals" subtitle="Pay out via UPI from your business account, then record the UTR. Rejected requests are returned to the seller's wallet." />
      <StatusTabs base="/admin/withdrawals" tabs={TABS} current={status} />
      {rows.length === 0 ? <EmptyState title="No withdrawals here" /> : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Requested</th><th>Seller</th><th>UPI</th><th>Amount</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id}>
                  <td className="text-xs text-muted">{w.createdAt.toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td><p>{w.user.seller?.storeName}</p><p className="text-xs text-muted">{w.user.seller?.legalName} · {w.user.email}</p></td>
                  <td className="font-mono text-xs">{w.upiId}</td><td className="font-semibold">{formatINR(w.amount)}</td>
                  <td><StatusBadge status={w.status} />{w.payoutRef && <p className="font-mono text-[11px] text-muted">{w.payoutRef}</p>}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {w.status === "PENDING" && <ActionButton url={`/api/admin/withdrawals/${w.id}`} body={{ action: "approve" }} label="Approve" success="Approved" />}
                      {["PENDING", "APPROVED"].includes(w.status) && <ActionButton url={`/api/admin/withdrawals/${w.id}`} body={{ action: "paid" }} variant="primary" label="Mark paid" prompt="UPI transaction reference (UTR):" promptKey="payoutRef" success="Marked paid" />}
                      {["PENDING", "APPROVED"].includes(w.status) && <ActionButton url={`/api/admin/withdrawals/${w.id}`} body={{ action: "reject" }} variant="danger" label="Reject" prompt="Reason (shown to seller):" promptKey="note" success="Rejected & refunded to wallet" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
