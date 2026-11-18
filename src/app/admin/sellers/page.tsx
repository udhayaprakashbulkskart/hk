import { db } from "@/lib/db";
import { ActionButton } from "@/components/forms/action-button";
import { StatusTabs, pick } from "@/components/admin/tabs";
import { StatusBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/section";

export const metadata = { title: "Seller verification" };
const TABS = ["PENDING", "VERIFIED", "REJECTED"] as const;

export default async function AdminSellers(props: PageProps<"/admin/sellers">) {
  const status = pick((await props.searchParams).status, TABS, "PENDING");
  const rows = await db.sellerProfile.findMany({ where: { status }, orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, email: true, name: true, createdAt: true, status: true } } }, take: 100 });
  return (
    <div>
      <PageTitle title="Seller verification" subtitle="Check identity and payout details before approving sellers." />
      <StatusTabs base="/admin/sellers" tabs={TABS} current={status} />
      {rows.length === 0 ? <EmptyState title="No sellers here" /> : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Store</th><th>Legal name</th><th>PAN (last 4)</th><th>UPI</th><th>Account</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td><p className="font-semibold">{s.storeName}</p><p className="text-xs text-muted">{s.bio?.slice(0, 60)}</p></td>
                  <td>{s.legalName}</td><td className="font-mono">{s.panLast4 ?? "—"}</td><td>{s.payoutUpi ?? "—"}</td>
                  <td><p>{s.user.email}</p><p className="text-xs text-muted">joined {s.user.createdAt.toLocaleDateString("en-IN")}</p></td>
                  <td><StatusBadge status={s.status} />{s.rejectionReason && <p className="mt-1 text-xs text-muted">{s.rejectionReason}</p>}</td>
                  <td className="whitespace-nowrap">
                    <div className="flex gap-2">
                      {s.status !== "VERIFIED" && <ActionButton url={`/api/admin/sellers/${s.user.id}`} body={{ action: "verify" }} variant="primary" label="Verify" success="Seller verified" />}
                      {s.status !== "REJECTED" && <ActionButton url={`/api/admin/sellers/${s.user.id}`} body={{ action: "reject" }} variant="danger" label="Reject" prompt="Reason (shown to applicant):" success="Application rejected" />}
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
