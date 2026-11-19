"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Shield, X } from "lucide-react";
import clsx from "clsx";
import { Logo } from "@/components/ui/logo";
import { ACCOUNT_NAV, CATEGORY_NAV, MAIN_NAV } from "./nav";
import { NavIcon } from "./icons";
import { isActive } from "./nav-link";

export function MobileDrawer({ signedIn, isAdmin }: { signedIn: boolean; isAdmin: boolean }) {
  const pathname = usePathname();
  // The drawer remembers the path it was opened on, so navigating closes it without an effect.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (v: boolean) => setOpenedOn(v ? pathname : null);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);
  const item = (href: string, label: string, icon: string) => (
    <Link key={href} href={href} className={clsx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm", isActive(pathname, href) ? "bg-neon/15 text-white" : "text-zinc-300 hover:bg-white/5")}>
      <NavIcon name={icon} className={clsx("size-4", isActive(pathname, href) && "text-neon")} /> {label}
    </Link>
  );
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Open menu" className="btn-ghost -ml-2 p-2 lg:hidden">
        <Menu className="size-6" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <nav aria-label="Mobile" className="absolute inset-y-0 left-0 flex w-[84%] max-w-xs animate-fade-up flex-col gap-1 overflow-y-auto border-r border-neon/40 bg-gradient-to-b from-[#3a0b10] to-[#1c0507] p-4">
            <div className="mb-3 flex items-center justify-between">
              <Logo />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="btn-ghost p-2">
                <X className="size-5" />
              </button>
            </div>
            {MAIN_NAV.map((i) => item(i.href, i.label, i.icon))}
            <p className="mt-3 px-3 text-[11px] font-semibold tracking-widest text-neon/80 uppercase">Categories</p>
            {CATEGORY_NAV.map((c) => item(`/category/${c.slug}`, c.label, c.icon))}
            <div className="my-2 border-t border-line" />
            {signedIn ? (
              <>
                {ACCOUNT_NAV.map((i) => item(i.href, i.label, i.icon))}
                {isAdmin && (
                  <Link href="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-neon-soft">
                    <Shield className="size-4" /> Admin panel
                  </Link>
                )}
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Link href="/login" className="btn-outline">Sign in</Link>
                <Link href="/register" className="btn-primary">Join</Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
