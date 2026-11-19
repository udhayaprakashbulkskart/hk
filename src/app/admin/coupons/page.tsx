import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { ActionButton } from "@/components/forms/action-button";
import { CouponForm } from "@/components/admin/admin-forms";
import { StatusBadge } from "@/components/ui/badges";
import { PageTitle } from "@/components/ui/section";

export const metadata = { title: "Coupons" };

export default async function AdminCoupons() {
  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });
  const now = new Date();
  return (
    <div className="space-y-6">
      <PageTitle title="Coupons" subtitle="Discount codes buyers apply at checkout. Discounts are funded from the platform commission." />
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Code</th><th>Discount</th><th>Min order</th><th>Used</th><th>Expires</th><th>Status</th><th /></tr></thead>
          <tbody>
            {coupons.map((c) => {
              const expired = c.endsAt != null && c.endsAt < now;
              return (
                <tr key={c.id}>
                  <td><p className="font-mono font-bold text-neon">{c.code}</p><p className="text-xs text-muted">{c.description}</p></td>
                  <td>{c.type === "PERCENT" ? `${c.value}%${c.maxDiscount ? ` (max ${formatINR(c.maxDiscount)})` : ""}` : formatINR(c.value)}</td>
                  <td>{c.minOrder ? formatINR(c.minOrder) : "—"}</td>
                  <td>{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""} <span className="text-xs text-muted">({c.perUserLimit}/user)</span></td>
                  <td className="text-xs">{c.endsAt ? c.endsAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Never"}</td>
                  <td><StatusBadge status={expired ? "EXPIRED" : c.isActive ? "ACTIVE" : "ARCHIVED"} /></td>
                  <td className="whitespace-nowrap">
                    <div className="flex gap-2">
                      <ActionButton url={`/api/admin/coupons/${c.id}`} body={{ isActive: !c.isActive }} label={c.isActive ? "Disable" : "Enable"} success="Coupon updated" className="btn-sm" />
                      <ActionButton url={`/api/admin/coupons/${c.id}`} method="DELETE" variant="danger" label="Delete" confirm="Delete this coupon? Used coupons are disabled instead." success="Done" className="btn-sm" />
                    </div>
                  </td>
                </tr>
              );
            })}
            {!coupons.length && <tr><td colSpan={7} className="py-6 text-center text-muted">No coupons yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <section className="card p-5"><h2 className="heading mb-4 text-lg">New coupon</h2><CouponForm /></section>
    </div>
  );
}
