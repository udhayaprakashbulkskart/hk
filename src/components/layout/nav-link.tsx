"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

export function NavLink({ href, children, className, activeClassName = "text-white after:scale-x-100" }: { href: string; children: React.ReactNode; className?: string; activeClassName?: string }) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={clsx(className, active && activeClassName)}>
      {children}
    </Link>
  );
}
