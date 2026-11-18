import Link from "next/link";
import { DISCLAIMER } from "@/lib/constants";
import { LogoMark } from "@/components/ui/logo";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-black/40 pb-24 md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center gap-2">
            <LogoMark className="size-8" />
            <span className="font-display text-lg font-bold tracking-wider italic">PUBG <span className="text-neon">STORE</span></span>
          </div>
          <p className="max-w-md text-sm text-muted">A marketplace for officially transferable PUBG Mobile & BGMI cosmetics and UC top-ups. We never ask for game passwords or OTPs.</p>
        </div>
        <div>
          <h4 className="heading mb-3 text-sm text-zinc-300">Marketplace</h4>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/skins" className="hover:text-white">Buy skins</Link></li>
            <li><Link href="/uc" className="hover:text-white">UC Store</Link></li>
            <li><Link href="/sell" className="hover:text-white">Become a seller</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="heading mb-3 text-sm text-zinc-300">Help</h4>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/support" className="hover:text-white">Support & FAQ</Link></li>
            <li><Link href="/terms" className="hover:text-white">Terms & policies</Link></li>
          </ul>
        </div>
      </div>
      <p className="mx-auto max-w-7xl border-t border-line px-4 py-5 text-xs leading-relaxed text-zinc-500 lg:px-6">{DISCLAIMER}</p>
    </footer>
  );
}
