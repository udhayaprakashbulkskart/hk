import Link from "next/link";
import { Bell, Search, ShoppingCart } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Logo } from "@/components/ui/logo";
import { MAIN_NAV } from "./nav";
import { NavLink } from "./nav-link";
import { UserMenu } from "./user-menu";
import { MobileDrawer } from "./mobile-drawer";

function CountDot({ n }: { n: number }) {
  if (!n) return null;
  return <span className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-neon shadow-neon px-1 text-[10px] leading-4 font-bold text-[#3a0a0e]">{n > 9 ? "9+" : n}</span>;
}

export async function Header() {
  const user = await getCurrentUser();
  const [cart, unread] = user
    ? await Promise.all([
        db.cartItem.aggregate({ where: { userId: user.id }, _sum: { quantity: true } }),
        db.notification.count({ where: { userId: user.id, readAt: null } }),
      ])
    : [null, 0];
  const cartCount = cart?._sum.quantity ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b border-neon/30 bg-[#2a070b]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 lg:px-6">
        <MobileDrawer signedIn={!!user} isAdmin={user?.role === "ADMIN"} />
        <div className="flex flex-1 justify-center lg:flex-none lg:justify-start">
          <Logo />
        </div>
        <nav aria-label="Main" className="ml-4 hidden items-center gap-0.5 lg:flex">
          {MAIN_NAV.map((i) => (
            <NavLink
              key={i.href}
              href={i.href}
              className="relative px-2 py-2 text-[12px] font-semibold tracking-wider whitespace-nowrap text-[#f3dcb8] uppercase transition after:absolute after:inset-x-2.5 after:-bottom-[13px] after:h-0.5 after:origin-left after:scale-x-0 after:bg-neon after:shadow-[0_0_12px_#f2c14e] after:transition hover:text-white lg:px-3"
            >
              {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <form action="/marketplace" className="relative hidden 2xl:block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
            <input name="q" placeholder="Search skins, outfits…" aria-label="Search" className="input w-56 py-2 pl-9" />
          </form>
          <Link href="/marketplace" aria-label="Search" className="btn-ghost p-2 2xl:hidden">
            <Search className="size-5" />
          </Link>
          {user ? (
            <>
              <Link href="/account/notifications" aria-label={`Notifications (${unread} unread)`} className="btn-ghost relative p-2">
                <Bell className="size-5" />
                <CountDot n={unread} />
              </Link>
              <Link href="/cart" aria-label={`Cart (${cartCount} items)`} className="btn-ghost relative hidden p-2 sm:inline-flex">
                <ShoppingCart className="size-5" />
                <CountDot n={cartCount} />
              </Link>
              <div className="hidden md:block">
                <UserMenu name={user.name} role={user.role} wallet={user.walletBalance} />
              </div>
            </>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link href="/login" className="btn-ghost text-xs tracking-wider whitespace-nowrap uppercase">Sign in</Link>
              <Link href="/register" className="btn-primary btn-sm px-4 py-2 text-[11px] tracking-[0.15em] whitespace-nowrap uppercase">Sign up</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
