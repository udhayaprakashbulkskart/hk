"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { BadgeCheck, ChartNoAxesCombined, Flag, FolderTree, Image as ImageIcon, LifeBuoy, Package, Percent, PartyPopper, Receipt, RotateCcw, ScrollText, TicketPercent, Users, Wallet } from "lucide-react";

const ITEMS = [
  { href: "/admin", label: "Analytics", Icon: ChartNoAxesCombined, key: "" },
  { href: "/admin/products", label: "Listings", Icon: Package, key: "products" },
  { href: "/admin/sellers", label: "Seller verification", Icon: BadgeCheck, key: "sellers" },
  { href: "/admin/orders", label: "Orders & payments", Icon: Receipt, key: "orders" },
  { href: "/admin/refunds", label: "Refunds", Icon: RotateCcw, key: "refunds" },
  { href: "/admin/withdrawals", label: "Withdrawals", Icon: Wallet, key: "withdrawals" },
  { href: "/admin/reports", label: "Reported listings", Icon: Flag, key: "reports" },
  { href: "/admin/users", label: "Users", Icon: Users, key: "users" },
  { href: "/admin/categories", label: "Categories", Icon: FolderTree, key: "categories" },
  { href: "/admin/coupons", label: "Coupons", Icon: TicketPercent, key: "coupons" },
  { href: "/admin/campaigns", label: "Home campaigns", Icon: PartyPopper, key: "campaigns" },
  { href: "/admin/banners", label: "Banners", Icon: ImageIcon, key: "banners" },
  { href: "/admin/tickets", label: "Support tickets", Icon: LifeBuoy, key: "tickets" },
  { href: "/admin/settings", label: "Commission", Icon: Percent, key: "settings" },
  { href: "/admin/audit", label: "Audit log", Icon: ScrollText, key: "audit" },
];

export function AdminNav({ counts }: { counts: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
      {ITEMS.map(({ href, label, Icon, key }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        const n = counts[key] ?? 0;
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={clsx("flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition", active ? "bg-neon/15 text-white ring-1 ring-neon/40" : "text-[#d9b98f] hover:bg-white/5 hover:text-white")}>
            <Icon className={clsx("size-4", active && "text-neon")} />
            <span className="flex-1 whitespace-nowrap">{label}</span>
            {n > 0 && <span className="rounded-full bg-neon px-1.5 text-[10px] font-bold text-[#3a0a0e]">{n}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
