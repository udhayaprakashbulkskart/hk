import type { Metadata } from "next";
import { DISCLAIMER } from "@/lib/constants";
import { PageTitle } from "@/components/ui/section";

export const metadata: Metadata = { title: "Terms & Policies" };

export default function TermsPage() {
  const sections: [string, string][] = [
    ["Independent store", DISCLAIMER],
    ["What we sell", "Only cosmetic items and top-ups that can be transferred through the relevant game's official mechanisms (in-game gifting to a Player ID, officially issued redeem codes, or authorised UC top-up channels) under that game's current terms. All products are listed by ZYNOFLIX STORE; customers cannot list items."],
    ["What is prohibited", "Selling, renting or sharing game accounts; requesting or collecting passwords, OTPs or login sessions; cheats, hacks or exploits; items obtained fraudulently. Accounts that attempt these may be suspended."],
    ["Payments", "Payments are processed by Razorpay or your ZYNOFLIX STORE wallet. An order is confirmed only after the payment is verified on our server."],
    ["Refunds", "Buyers may request a refund before confirming receipt. Approved refunds are returned to the original payment method or your wallet."],
    ["Privacy", "We store the minimum data needed to run the store: your account details, Player ID and nickname for delivery, and order history."],
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
