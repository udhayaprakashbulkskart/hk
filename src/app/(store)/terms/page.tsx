import type { Metadata } from "next";
import { DISCLAIMER } from "@/lib/constants";
import { PageTitle } from "@/components/ui/section";

export const metadata: Metadata = { title: "Terms & Policies" };

export default function TermsPage() {
  const sections: [string, string][] = [
    ["Independent marketplace", DISCLAIMER],
    ["What can be sold", "Only cosmetic items and top-ups that can be transferred through the relevant game's official mechanisms (in-game gifting to a Player ID, officially issued redeem codes, or authorised UC top-up channels) under that game's current terms. Sellers must confirm this for every listing."],
    ["What is prohibited", "Selling, renting or sharing game accounts; requesting or collecting passwords, OTPs or login sessions; cheats, hacks or exploits; items obtained fraudulently. Listings that break these rules are removed and the seller may be suspended."],
    ["Payments & escrow", "Payments are processed by Razorpay or your DROPZONE STORE wallet. Seller earnings are released only after the buyer confirms receipt or the protection window passes. A platform commission (shown in the seller hub) is deducted from each completed sale."],
    ["Refunds", "Buyers may request a refund before confirming receipt. Approved refunds are returned to the original payment method or your wallet."],
    ["Privacy", "We store the minimum data needed to run the marketplace: your account details, Player ID for delivery, order history and, for sellers, verification and payout details (PAN last 4 characters and UPI ID only)."],
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Terms & Policies" subtitle="Plain-language summary. Have a lawyer review before going live." />
      <div className="space-y-3">
        {sections.map(([h, b]) => (
          <section key={h} className="card p-5"><h2 className="heading mb-2 text-lg">{h}</h2><p className="text-sm leading-relaxed text-zinc-300">{b}</p></section>
        ))}
      </div>
    </div>
  );
}
