import { db } from "@/lib/db";
import { ActionButton } from "@/components/forms/action-button";
import { StatusTabs, pick } from "@/components/admin/tabs";
import { StatusBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/section";

export const metadata = { title: "Support tickets" };
const TABS = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;

export default async function AdminTickets(props: PageProps<"/admin/tickets">) {
  const status = pick((await props.searchParams).status, TABS, "OPEN");
  const rows = await db.supportTicket.findMany({ where: { status }, orderBy: { createdAt: "asc" }, take: 100 });
  return (
    <div>
      <PageTitle title="Support tickets" />
      <StatusTabs base="/admin/tickets" tabs={TABS} current={status} />
      {rows.length === 0 ? <EmptyState title="Inbox zero" /> : (
        <ul className="space-y-3">
          {rows.map((t) => (
            <li key={t.id} className="card space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{t.subject}</p><StatusBadge status={t.status} /><span className="ml-auto text-xs text-muted">{t.email} · {t.orderRef ?? "no order"} · {t.createdAt.toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span></div>
              <p className="text-sm whitespace-pre-line text-zinc-300">{t.message}</p>
              {t.adminReply && <p className="rounded-lg bg-panel-2 p-3 text-sm"><span className="text-neon">Reply:</span> {t.adminReply}</p>}
              {t.status !== "CLOSED" && (
                <div className="flex gap-2">
                  <ActionButton url={`/api/admin/tickets/${t.id}`} body={{ status: "IN_PROGRESS" }} variant="primary" label="Reply" prompt="Reply to the user:" promptKey="adminReply" success="Reply sent" />
                  <ActionButton url={`/api/admin/tickets/${t.id}`} body={{ status: "CLOSED" }} label="Close" success="Ticket closed" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
