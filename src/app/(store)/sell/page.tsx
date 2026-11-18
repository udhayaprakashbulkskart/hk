import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Clock, IndianRupee, ListChecks, Package, Plus, ShieldCheck, XCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { getCommissionBps } from "@/lib/settings";
import { SellerOnboardForm } from "@/components/forms/seller-onboard-form";
import { PageTitle } from "@/components/ui/section";
import { RENDERS } from "@/lib/media";

export const metadata: Metadata = { title: "Sell Items" };

function Hero() {
  return (
    <div className="card relative mb-6 flex flex-col items-center overflow-hidden p-6 text-center sm:flex-row sm:text-left">
      <div className="absolute inset-0 bg-gradient-to-br from-crimson/40 via-transparent to-transparent" />
      <div className="relative h-48 w-36 shrink-0 sm:h-56 sm:w-44">
        <div className="absolute bottom-1 left-1/2 h-4 w-3/4 -translate-x-1/2 rounded-[50%] bg-mint/40 blur-md" />
        <Image src={RENDERS.abyssalDragon} alt="" fill sizes="176px" className="animate-float object-contain drop-shadow-[0_14px_28px_rgba(0,0,0,0.7)]" />
      </div>
      <div className="relative mt-4 sm:mt-0 sm:ml-6">
        <h2 className="heading text-2xl sm:text-3xl">List your PUBG / BGMI items and earn real money</h2>
        <p className="mt-2 text-sm text-zinc-300">Verified sellers, escrow-protected payouts to UPI, and a team that keeps scammers out.</p>
      </div>
    </div>
  );
}

export default async function SellPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div>
        <PageTitle title="Sell Your Items" />
        <Hero />
        <div className="card p-6 text-center">
          <p className="mb-4 text-muted">Sign in to apply as a seller.</p>
          <Link href="/login?next=/sell" className="btn-primary">Sign in to start selling</Link>
        </div>
      </div>
    );
  }
  const profile = await db.sellerProfile.findUnique({ where: { userId: user.id } });
  const commission = (await getCommissionBps()) / 100;

  if (!profile || profile.status === "REJECTED") {
    return (
      <div className="mx-auto max-w-3xl">
        <PageTitle title="Become a Seller" subtitle={`Platform commission: ${commission}% per completed sale. No listing fees.`} />
        <Hero />
        {profile?.status === "REJECTED" && (
          <div className="card mb-4 flex gap-3 border-neon/40 p-4 text-sm">
            <XCircle className="size-5 shrink-0 text-neon" />
            <p>Your previous application was declined: <b>{profile.rejectionReason}</b>. Update your details and resubmit.</p>
          </div>
        )}
        <div className="card p-5 sm:p-6">
          <SellerOnboardForm defaults={profile ?? { legalName: user.name }} />
        </div>
      </div>
    );
  }

  if (profile.status === "PENDING") {
    return (
      <div className="mx-auto max-w-xl py-6">
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <Clock className="size-10 text-warn" />
          <h1 className="heading text-2xl">Application under review</h1>
          <p className="text-sm text-muted">We&apos;re verifying <b className="text-white">{profile.storeName}</b>. This usually takes under 24 hours. You&apos;ll get a notification once approved.</p>
        </div>
      </div>
    );
  }

  const [stats, pendingDelivery, earnings] = await Promise.all([
    db.product.groupBy({ by: ["status"], where: { sellerId: user.id }, _count: true }),
    db.orderItem.count({ where: { sellerId: user.id, status: "PROCESSING" } }),
    db.orderItem.aggregate({ where: { sellerId: user.id, status: "COMPLETED" }, _sum: { sellerEarning: true } }),
  ]);
  const count = (s: string) => stats.find((x) => x.status === s)?._count ?? 0;
  const tiles = [
    { label: "Live listings", value: count("APPROVED"), Icon: ListChecks, href: "/sell/listings" },
    { label: "In review", value: count("PENDING"), Icon: Clock, href: "/sell/listings?status=PENDING" },
    { label: "To deliver", value: pendingDelivery, Icon: Package, href: "/account/sales", hot: pendingDelivery > 0 },
    { label: "Total earned", value: formatINR(earnings._sum.sellerEarning ?? 0), Icon: IndianRupee, href: "/wallet" },
  ];
  return (
    <div>
      <PageTitle title="Seller Hub" subtitle={`${profile.storeName} · ${commission}% commission on completed sales`}>
        <Link href="/sell/new" className="btn-primary"><Plus className="size-4" /> New listing</Link>
      </PageTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ label, value, Icon, href, hot }) => (
          <Link key={label} href={href} className={`card-glow p-4 ${hot ? "animate-pulse-glow" : ""}`}>
            <Icon className="size-5 text-neon" />
            <p className="mt-3 font-display text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted">{label}</p>
          </Link>
        ))}
      </div>
      <div className="card mt-6 flex gap-3 p-4 text-sm text-zinc-300">
        <ShieldCheck className="size-5 shrink-0 text-neon" />
        <p>Deliver only via official in-game gifting or redeem codes to the buyer&apos;s Player ID. Earnings are released to your wallet when the buyer confirms receipt (or automatically after the protection window).</p>
      </div>
    </div>
  );
}
