"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Shield } from "lucide-react";
import { api } from "@/lib/client";
import { formatINR } from "@/lib/money";
import { ACCOUNT_NAV } from "./nav";
import { NavIcon } from "./icons";

export function UserMenu({ name, role, wallet }: { name: string; role: string; wallet: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2 rounded-xl border border-line bg-panel-2 py-1.5 pr-2 pl-1.5 text-sm hover:border-neon/50">
        <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-neon to-crimson text-xs font-bold">{name.slice(0, 1).toUpperCase()}</span>
        <span className="hidden max-w-28 truncate lg:inline">{name}</span>
        <ChevronDown className="size-4 text-muted" />
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 z-50 mt-2 w-64 animate-fade-up p-2">
          <div className="mb-1 rounded-xl bg-panel-2 px-3 py-2.5">
            <p className="text-xs text-muted">Wallet balance</p>
            <p className="font-display text-lg font-bold">{formatINR(wallet)}</p>
          </div>
          {ACCOUNT_NAV.map((i) => (
            <Link key={i.href} href={i.href} onClick={() => setOpen(false)} role="menuitem" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white">
              <NavIcon name={i.icon} /> {i.label}
            </Link>
          ))}
          {role === "ADMIN" && (
            <Link href="/admin" onClick={() => setOpen(false)} role="menuitem" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-neon-soft hover:bg-neon/10">
              <Shield className="size-4" /> Admin panel
            </Link>
          )}
          <button onClick={logout} role="menuitem" className="mt-1 flex w-full items-center gap-3 rounded-lg border-t border-line px-3 py-2 text-sm text-zinc-400 hover:text-white">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
