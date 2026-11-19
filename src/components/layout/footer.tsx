import Link from "next/link";
import { DISCLAIMER } from "@/lib/constants";
import { LogoMark } from "@/components/ui/logo";
import { CATEGORY_NAV } from "./nav";

const col = (title: string, links: [string, string][]) => (
  <div>
    <h4 className="heading mb-3 text-sm text-neon">{title}</h4>
    <ul className="space-y-2 text-sm text-muted">
      {links.map(([href, label]) => (
        <li key={href}><Link href={href} className="transition hover:text-white">{label}</Link></li>
      ))}
    </ul>
  </div>
);

export function Footer() {
  return (
    <footer className="relative mt-16 border-t border-neon/40 bg-gradient-to-b from-[#2a070b] to-[#140304] pb-24 md:pb-0">
      <div className="hazard absolute inset-x-0 top-0 h-px" />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-5 lg:px-6">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center gap-2">
            <LogoMark className="size-9" />
            <span className="font-display text-lg font-extrabold tracking-[0.12em]"><span className="gold-text">ZYNOFLIX</span> <span className="text-[#ffe9b8]">STORE</span></span>
          </div>
          <p className="max-w-md text-sm text-muted">An independent marketplace for officially transferable PUBG Mobile &amp; BGMI cosmetics and UC top-ups. We never ask for game passwords or OTPs.</p>
        </div>
        {col("Shop", [["/marketplace", "All products"], ...CATEGORY_NAV.slice(0, 4).map((c) => [`/category/${c.slug}`, c.label] as [string, string]), ["/uc", "UC Top-Up"]])}
        {col("Account", [["/orders", "My orders"], ["/wishlist", "Wishlist"], ["/cart", "Cart"], ["/account", "Profile"]])}
        {col("Help", [["/contact", "Contact us"], ["/faq", "FAQ"], ["/support", "Support tickets"], ["/terms", "Terms of service"], ["/privacy", "Privacy policy"]])}
      </div>
      <p className="mx-auto max-w-7xl border-t border-neon/20 px-4 py-5 text-xs leading-relaxed text-[#b89a7a] lg:px-6">{DISCLAIMER}</p>
    </footer>
  );
}
