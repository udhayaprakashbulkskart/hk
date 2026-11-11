import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const notifications = await api.listNotifications();
  const unread = notifications.filter((n) => !n.read).length;
  return <AppShell unread={unread}>{children}</AppShell>;
}
