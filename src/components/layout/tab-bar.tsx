"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Home, Plus, Receipt, Store, User } from "lucide-react";
import { isActive } from "./nav-link";

const TABS = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/marketplace", label: "Market", Icon: Store },
  { href: "/sell/new", label: "Sell", Icon: Plus, primary: true },
  { href: "/orders", label: "Orders", Icon: Receipt },
  { href: "/account", label: "Profile", Icon: User },
];

/** Mobile bottom navigation, mirroring the app-style mockup. */
export function TabBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return (
    <nav aria-label="Tabs" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <ul className="grid grid-cols-5">
        {TABS.map(({ href, label, Icon, primary }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex justify-center">
              {primary ? (
                <Link href={href} aria-label="Sell an item" className="-mt-5 grid size-14 place-items-center rounded-full bg-gradient-to-b from-neon to-crimson shadow-neon ring-4 ring-ink">
                  <Icon className="size-6" />
                </Link>
              ) : (
                <Link href={href} aria-current={active ? "page" : undefined} className={clsx("flex flex-col items-center gap-0.5 py-2 text-[11px]", active ? "text-neon" : "text-zinc-400")}>
                  <Icon className="size-5" />
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
