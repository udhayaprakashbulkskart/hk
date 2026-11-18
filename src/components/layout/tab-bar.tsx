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
    <nav aria-label="Tabs" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden">
      <ul className="grid grid-cols-5">
        {TABS.map(({ href, label, Icon, primary }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex justify-center">
              {primary ? (
                <Link href={href} aria-label="Sell an item" className="-mt-6 grid size-14 place-items-center rounded-full bg-gradient-to-br from-mint via-neon to-crimson text-white shadow-neon ring-4 ring-ink transition active:scale-95">
                  <Icon className="size-6" />
                </Link>
              ) : (
                <Link href={href} aria-current={active ? "page" : undefined} className={clsx("flex flex-col items-center gap-0.5 py-2 text-[11px]", active ? "text-mint drop-shadow-[0_0_8px_#2ef5c6]" : "text-zinc-400")}>
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
