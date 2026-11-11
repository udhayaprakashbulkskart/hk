"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Bell, Search, Home, LineChart, ArrowLeftRight, PieChart, MoreHorizontal } from "lucide-react";
import { Logo, cn } from "@hkfinhub/ui";
import { ThemeToggle } from "./theme-toggle";
import { NAV } from "@/lib/nav";

const BOTTOM = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/invest", label: "Markets", icon: LineChart },
  { href: "/send", label: "Transfer", icon: ArrowLeftRight },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/more", label: "More", icon: MoreHorizontal },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

// Pages reached through the "More" tab on small screens.
const MORE_PATHS = ["/more", "/accounts", "/receive", "/exchange", "/history", "/reports", "/notifications", "/security", "/profile", "/settings"];
const isMoreActive = (pathname: string) => MORE_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

export function AppShell({ children, unread = 0 }: { children: ReactNode; unread?: number }) {
  const pathname = usePathname();
  return (
    <div className="min-h-dvh bg-[var(--background)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-[var(--card)] focus:px-3 focus:py-2">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[var(--border)] bg-[var(--card)] lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/dashboard" aria-label="HK FinHub home"><Logo /></Link>
        </div>
        <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  active ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--border)] p-4 text-xs text-[var(--muted-foreground)]">
          Not a bank account
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <div className="lg:hidden">
              <Link href="/dashboard" aria-label="HK FinHub home"><Logo showWordmark={false} /></Link>
            </div>
            <form action="/invest" role="search" className="relative hidden flex-1 max-w-md md:block">
              <label htmlFor="global-search" className="sr-only">Search stocks, funds or symbols</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" aria-hidden="true" />
              <input
                id="global-search"
                name="q"
                type="search"
                placeholder="Search stocks, funds or symbols"
                className="min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] py-2 pl-9 pr-3 text-sm placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              />
            </form>
            <div className="ml-auto flex items-center gap-1">
              <Link href="/send" className="hidden min-h-10 items-center rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] sm:inline-flex">
                Send money
              </Link>
              <ThemeToggle />
              <Link href="/notifications" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} className="relative inline-flex size-11 items-center justify-center rounded-lg hover:bg-[var(--secondary)] sm:size-10">
                <Bell className="size-5" aria-hidden="true" />
                {unread > 0 ? <span className="absolute right-2 top-2 size-2 rounded-full bg-[var(--primary)]" aria-hidden="true" /> : null}
              </Link>
              <Link href="/profile" aria-label="Your profile" className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--gold)] bg-[var(--secondary)] text-xs font-semibold text-[var(--gold)]">
                HK
              </Link>
            </div>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-8">
          {children}
        </main>
      </div>

      {/* Mobile and tablet bottom navigation */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--card)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="grid grid-cols-5">
          {BOTTOM.map(({ href, label, icon: Icon }) => {
            const active = href === "/more" ? isMoreActive(pathname) : isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]")}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
