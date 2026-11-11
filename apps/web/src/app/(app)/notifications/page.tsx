import { Badge, cn } from "@hkfinhub/ui";
import { PageHeader } from "@/components/page";
import { api } from "@/lib/api";

const CAT = { security: "Security", payment: "Payment", transfer: "Transfer", kyc: "Verification", trade: "Trading", system: "System" } as const;
const TONE = { security: "danger", payment: "success", transfer: "gold", kyc: "primary", trade: "gold", system: "neutral" } as const;

export default async function NotificationsPage() {
  const items = await api.listNotifications();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Activity" title="Notifications" description="Security alerts are always sent, whatever your preferences." />
      <ul className="space-y-3">
        {items.map((n) => (
          <li key={n.id} className={cn("rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4", !n.read && "border-l-4 border-l-[var(--primary)]")}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={TONE[n.category]}>{CAT[n.category]}</Badge>
              {!n.read ? <span className="text-xs font-semibold text-[var(--primary)]">New</span> : null}
              <time dateTime={n.createdAt} className="ml-auto text-xs text-[var(--muted-foreground)] tabular-nums">{new Date(n.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Hong_Kong", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} HKT</time>
            </div>
            <p className="mt-2 font-medium">{n.title}</p>
            <p className="text-sm text-[var(--muted-foreground)]">{n.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
