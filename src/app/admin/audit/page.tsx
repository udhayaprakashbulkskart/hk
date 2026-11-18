import { db } from "@/lib/db";
import { PageTitle } from "@/components/ui/section";

export const metadata = { title: "Audit log" };

export default async function AdminAudit(props: PageProps<"/admin/audit">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const rows = await db.auditLog.findMany({
    where: q ? { OR: [{ action: { contains: q } }, { entityId: q }, { actor: { email: { contains: q, mode: "insensitive" } } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { email: true } } },
  });
  return (
    <div>
      <PageTitle title="Audit log" subtitle="Every sensitive action — logins, payments, moderation, refunds, payouts, settings.">
        <form><input name="q" defaultValue={q} placeholder="Filter by action, entity id, email" className="input w-72" /></form>
      </PageTitle>
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="text-xs whitespace-nowrap text-muted">{r.createdAt.toLocaleString("en-IN", { dateStyle: "short", timeStyle: "medium" })}</td>
                <td className="text-xs">{r.actor?.email ?? "system"}</td>
                <td className="font-mono text-xs text-neon-soft">{r.action}</td>
                <td className="font-mono text-[11px] text-muted">{r.entityType}{r.entityId ? `:${r.entityId.slice(-8)}` : ""}</td>
                <td className="max-w-md truncate font-mono text-[11px] text-zinc-400">{r.meta ? JSON.stringify(r.meta) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
