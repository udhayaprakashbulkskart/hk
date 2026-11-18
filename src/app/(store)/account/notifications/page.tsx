import type { Metadata } from "next";
import Link from "next/link";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActionButton } from "@/components/forms/action-button";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/section";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await pageUser("/account/notifications");
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Notifications" subtitle={`${unread} unread`}>
        {unread > 0 && <ActionButton url="/api/notifications/read" method="POST" label="Mark all read" success="All caught up" />}
      </PageTitle>
      {items.length === 0 ? (
        <EmptyState title="No notifications" />
      ) : (
        <ul className="card divide-y divide-line/60">
          {items.map((n) => {
            const body = (
              <div className="flex gap-3 px-4 py-3.5">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-neon shadow-neon"}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.readAt ? "text-zinc-300" : "font-semibold text-white"}`}>{n.title}</p>
                  <p className="text-sm text-muted">{n.body}</p>
                  <p className="mt-1 text-xs text-zinc-500">{n.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
                </div>
              </div>
            );
            return <li key={n.id}>{n.link ? <Link href={n.link} className="block hover:bg-white/5">{body}</Link> : body}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
