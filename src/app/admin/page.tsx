import { IndianRupee, Percent, Receipt, ShoppingBag, Users } from "lucide-react";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { PageTitle } from "@/components/ui/section";

export const metadata = { title: "Analytics" };

const DAY = 86_400_000;
const daysAgo = (n: number, from = Date.now()) => new Date(from - n * DAY);

export default async function AdminHome() {
  const since = daysAgo(30);
  const paidStatuses = ["PAID", "COMPLETED", "PARTIALLY_REFUNDED"] as const;
  const [gmv, gmv30, users, newUsers, sellers, liveListings, refunded, daily, byCategory, topSellers] = await Promise.all([
    db.order.aggregate({ where: { status: { in: [...paidStatuses] } }, _sum: { total: true, platformFee: true }, _count: true }),
    db.order.aggregate({ where: { status: { in: [...paidStatuses] }, paidAt: { gte: since } }, _sum: { total: true, platformFee: true }, _count: true }),
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: since } } }),
    db.sellerProfile.count({ where: { status: "VERIFIED" } }),
    db.product.count({ where: { status: "APPROVED" } }),
    db.refund.aggregate({ where: { status: "PROCESSED" }, _sum: { amount: true } }),
    db.$queryRaw<{ day: Date; revenue: bigint; commission: bigint; orders: bigint }[]>`
      SELECT date_trunc('day', "paidAt") AS day, SUM("total")::bigint AS revenue, SUM("platformFee")::bigint AS commission, COUNT(*)::bigint AS orders
      FROM "Order" WHERE "paidAt" >= ${since} AND "status" IN ('PAID','COMPLETED','PARTIALLY_REFUNDED')
      GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ name: string; revenue: bigint; units: bigint }[]>`
      SELECT c."name", SUM(oi."lineTotal")::bigint AS revenue, SUM(oi."quantity")::bigint AS units
      FROM "OrderItem" oi JOIN "Product" p ON p."id" = oi."productId" JOIN "Category" c ON c."id" = p."categoryId"
      WHERE oi."status" NOT IN ('AWAITING_PAYMENT','CANCELLED','REFUNDED')
      GROUP BY c."name" ORDER BY revenue DESC LIMIT 6`,
    db.sellerProfile.findMany({ where: { status: "VERIFIED", user: { role: { not: "ADMIN" } } }, orderBy: { totalSales: "desc" }, take: 5, select: { storeName: true, totalSales: true, ratingAvg: true } }),
  ]);
  // Fill missing days so the chart has a continuous 30-day axis.
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = daysAgo(29 - i);
    const key = d.toISOString().slice(0, 10);
    const row = daily.find((r) => new Date(r.day).toISOString().slice(0, 10) === key);
    return { key, label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), revenue: Number(row?.revenue ?? 0), orders: Number(row?.orders ?? 0) };
  });
  const maxRev = Math.max(1, ...days.map((d) => d.revenue));
  const maxCat = Math.max(1, ...byCategory.map((c) => Number(c.revenue)));

  const kpis = [
    { label: "GMV · 30 days", value: formatINR(gmv30._sum.total ?? 0), sub: `${formatINR(gmv._sum.total ?? 0)} all time`, Icon: IndianRupee },
    { label: "Commission · 30 days", value: formatINR(gmv30._sum.platformFee ?? 0), sub: `${formatINR(gmv._sum.platformFee ?? 0)} all time`, Icon: Percent },
    { label: "Paid orders · 30 days", value: gmv30._count.toLocaleString("en-IN"), sub: `${gmv._count} all time · ${formatINR(refunded._sum.amount ?? 0)} refunded`, Icon: Receipt },
    { label: "Users", value: users.toLocaleString("en-IN"), sub: `+${newUsers} in 30 days · ${sellers} sellers`, Icon: Users },
    { label: "Live listings", value: liveListings.toLocaleString("en-IN"), sub: "approved & in stock or sold out", Icon: ShoppingBag },
  ];
  return (
    <div className="space-y-6">
      <PageTitle title="Analytics" subtitle="Revenue and marketplace health." />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {kpis.map(({ label, value, sub, Icon }) => (
          <div key={label} className="card p-4">
            <p className="flex items-center gap-2 text-xs text-muted"><Icon className="size-4 text-neon" /> {label}</p>
            <p className="mt-2 font-display text-2xl font-bold">{value}</p>
            <p className="text-[11px] text-zinc-500">{sub}</p>
          </div>
        ))}
      </div>
      <section className="card p-5">
        <h2 className="heading mb-4 text-lg">Revenue · last 30 days</h2>
        <div className="flex h-48 items-end gap-[3px]" role="img" aria-label="Daily revenue for the last 30 days">
          {days.map((d) => (
            <div key={d.key} className="group relative flex h-full flex-1 items-end">
              <div className="w-full rounded-t-sm bg-gradient-to-t from-crimson to-neon opacity-80 transition group-hover:opacity-100" style={{ height: `${(d.revenue / maxRev) * 100}%`, minHeight: d.revenue ? 3 : 1 }} />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-lg border border-line bg-panel px-2 py-1 text-[11px] whitespace-nowrap group-hover:block">
                {d.label}: {formatINR(d.revenue)} · {d.orders} orders
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-zinc-500"><span>{days[0].label}</span><span>{days[29].label}</span></div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="heading mb-4 text-lg">Sales by category</h2>
          {byCategory.length === 0 ? <p className="text-sm text-muted">No sales yet.</p> : (
            <ul className="space-y-3">
              {byCategory.map((c) => (
                <li key={c.name}>
                  <div className="mb-1 flex justify-between text-sm"><span>{c.name}</span><span className="text-muted">{formatINR(Number(c.revenue))} · {Number(c.units)} units</span></div>
                  <div className="h-2 rounded-full bg-panel-2"><div className="h-2 rounded-full bg-neon" style={{ width: `${(Number(c.revenue) / maxCat) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5">
          <h2 className="heading mb-4 text-lg">Top sellers</h2>
          <table className="table-base">
            <thead><tr><th>Store</th><th>Sales</th><th>Rating</th></tr></thead>
            <tbody>{topSellers.map((s) => <tr key={s.storeName}><td>{s.storeName}</td><td>{s.totalSales}</td><td>{s.ratingAvg ? s.ratingAvg.toFixed(1) : "—"}</td></tr>)}</tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
