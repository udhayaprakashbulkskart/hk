import type { Metadata } from "next";
import Link from "next/link";
import { Bell, ChevronRight, Heart, LifeBuoy, Receipt, Settings, Shield, Wallet } from "lucide-react";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "My Profile" };

export default async function AccountPage() {
  const user = await pageUser("/account");
  const [purchases, saved, unread] = await Promise.all([
    db.order.count({ where: { buyerId: user.id, status: { not: "CANCELLED" } } }),
    db.wishlistItem.count({ where: { userId: user.id } }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  const links = [
    { href: "/orders", label: "My Purchases", Icon: Receipt, extra: purchases },
    { href: "/wishlist", label: "Wishlist", Icon: Heart, extra: saved },
    { href: "/account/notifications", label: "Notifications", Icon: Bell, extra: unread || undefined },
    { href: "/wallet", label: "Wallet", Icon: Wallet },
    { href: "/account/settings", label: "Account Settings", Icon: Settings },
    { href: "/support", label: "Support", Icon: LifeBuoy },
    ...(user.role === "ADMIN" ? [{ href: "/admin", label: "Admin panel", Icon: Shield }] : []),
  ];
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="card flex items-center gap-4 p-5">
        <span className="grid size-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-neon to-crimson font-display text-2xl font-bold ring-2 ring-neon/40">{user.name.slice(0, 1)}</span>
        <div className="min-w-0">
          <h1 className="heading truncate text-2xl">{user.name}</h1>
          <p className="truncate text-sm text-muted">{user.email}</p>
        </div>
      </div>
      <Link href="/wallet" className="card-glow flex items-center gap-4 p-5">
        <div className="flex-1"><p className="text-sm text-muted">Wallet balance</p><p className="font-display text-3xl font-bold">{formatINR(user.walletBalance)}</p></div>
        <span className="btn-primary">Open wallet</span>
      </Link>
      <nav className="card divide-y divide-line/60">
        {links.map(({ href, label, Icon, ...rest }) => (
          <Link key={href} href={href} className="flex items-center gap-3 px-5 py-4 text-sm transition hover:bg-white/5">
            <Icon className="size-5 text-zinc-400" />
            <span className="flex-1">{label}</span>
            {"extra" in rest && rest.extra ? <span className="rounded-full bg-panel-2 px-2 text-xs text-muted">{rest.extra}</span> : null}
            <ChevronRight className="size-4 text-zinc-500" />
          </Link>
        ))}
      </nav>
    </div>
  );
}
