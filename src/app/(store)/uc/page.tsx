import type { Metadata } from "next";
import Image from "next/image";
import { Info, ShieldCheck, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { AddToCartButton, BuyNowButton } from "@/components/product/cart-buttons";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/section";

export const metadata: Metadata = { title: "UC Store" };

export default async function UcPage() {
  const packs = await db.product.findMany({ where: { isOfficialStore: true, status: "APPROVED", category: { slug: "uc-topup" } }, orderBy: { price: "asc" } });
  return (
    <div>
      <PageTitle title="UC Store" subtitle="Top up Unknown Cash straight to your Player ID. Instant · Secure · Best price." />
      <div className="card mb-6 flex gap-3 border-sky-500/30 p-4 text-sm text-zinc-300">
        <Info className="size-5 shrink-0 text-sky-400" />
        <p>UC is credited to your Player ID through an authorised top-up channel. You only enter your Player ID at checkout — we will <b>never</b> ask for your login, password or OTP.</p>
      </div>
      {packs.length === 0 ? (
        <EmptyState title="UC packs coming soon" body="Top-ups are temporarily unavailable." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {packs.map((p, i) => (
            <div key={p.id} className="card-glow relative flex flex-col items-center gap-2 p-4 text-center">
              {i === 2 && <span className="badge absolute top-3 right-3 border-neon/60 bg-neon/20 text-white">Popular</span>}
              <div className="relative size-24"><Image src="/art/coin-1.svg" alt="" fill className="rounded-2xl object-cover" unoptimized /></div>
              <p className="font-display text-3xl font-bold">{p.ucAmount?.toLocaleString("en-IN")} <span className="text-lg text-amber-300">UC</span></p>
              <p className="text-lg font-semibold text-neon">{formatINR(p.price)}</p>
              <div className="mt-2 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                <AddToCartButton productId={p.id} className="btn-sm py-2" />
                <BuyNowButton productId={p.id} className="btn-sm py-2" />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <p className="card flex items-center gap-3 p-4 text-sm"><Zap className="size-5 text-amber-400" /> Usually credited within minutes of payment.</p>
        <p className="card flex items-center gap-3 p-4 text-sm"><ShieldCheck className="size-5 text-neon" /> Full refund if the top-up can&apos;t be completed.</p>
      </div>
    </div>
  );
}
