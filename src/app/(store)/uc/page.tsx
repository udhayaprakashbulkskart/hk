import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, CreditCard, Gamepad2, IdCard, PackageCheck } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { UcTopup } from "@/components/uc/uc-topup";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/section";

export const metadata: Metadata = {
  title: "UC Top-Up — PUBG Mobile & BGMI",
  description: "Buy PUBG Mobile and BGMI UC packs with your Player ID only. Secure Razorpay payments and order tracking.",
  alternates: { canonical: "/uc" },
};

const STEPS = [
  { Icon: Gamepad2, t: "Pick your game" },
  { Icon: ClipboardList, t: "Choose a package" },
  { Icon: IdCard, t: "Enter Player ID & nickname" },
  { Icon: CreditCard, t: "Pay securely" },
  { Icon: PackageCheck, t: "Track in My Orders" },
];

export default async function UcPage(props: PageProps<"/uc">) {
  const sp = await props.searchParams;
  const user = await getCurrentUser();
  const packs = await db.product.findMany({
    where: { isOfficialStore: true, status: "APPROVED", stock: { gt: 0 }, category: { slug: "uc-topup" } },
    orderBy: { price: "asc" },
    select: { id: true, ucAmount: true, price: true, compareAtPrice: true, game: true },
  });
  const defaultGame = sp.game === "BGMI" || (sp.game !== "PUBG_MOBILE" && user?.preferredGame === "BGMI") ? "BGMI" : "PUBG_MOBILE";
  return (
    <div>
      <PageTitle title="UC Top-Up" subtitle="Unknown Cash for PUBG Mobile and BGMI, sent to your Player ID. We never ask for your login, password or OTP." />
      <ol className="mb-6 grid grid-cols-5 gap-1 text-center text-[10px] text-[#c9d1d8] sm:gap-3 sm:text-xs">
        {STEPS.map(({ Icon, t }, i) => (
          <li key={t} className="flex flex-col items-center gap-1.5">
            <span className="grid size-9 place-items-center rounded-full border border-neon/60 bg-[#30353b] text-neon sm:size-11"><Icon className="size-4 sm:size-5" /></span>
            <span><b className="text-neon">{i + 1}.</b> {t}</span>
          </li>
        ))}
      </ol>
      {packs.length === 0 ? (
        <EmptyState title="UC packs coming soon" body="Top-ups are temporarily unavailable." />
      ) : (
        <UcTopup packs={packs.map((p) => ({ ...p, ucAmount: p.ucAmount ?? 0 }))} defaultGame={defaultGame} defaultPlayerId={user?.gamePlayerId ?? ""} />
      )}
      <p className="mt-8 text-center text-xs text-muted">
        Top-ups are fulfilled by the ZYNOFLIX team after your payment is confirmed. Status updates appear in <Link href="/orders" className="text-neon hover:underline">My Orders</Link>; if a top-up can&apos;t be completed you can request a refund from the order.
      </p>
    </div>
  );
}
