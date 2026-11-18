import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SupportForm } from "@/components/forms/account-forms";
import { StatusBadge } from "@/components/ui/badges";
import { PageTitle } from "@/components/ui/section";

export const metadata: Metadata = { title: "Support" };

const FAQ = [
  ["Do you need my game password or OTP?", "Never. We only need your in-game Player ID. Anyone asking for your password or OTP is a scammer — report them."],
  ["How is my item delivered?", "Sellers use the game's official in-game gifting or officially issued redeem codes, sent to the Player ID you enter at checkout."],
  ["When does the seller get paid?", "Funds are held in escrow. The seller is paid after you confirm receipt, or automatically after the protection window if you don't raise an issue."],
  ["What if I don't receive my item?", "Open the order and tap “Request refund” before confirming receipt. Our team reviews every request; approved refunds go to your wallet or original payment method."],
  ["Can I buy or sell game accounts?", "No. Account trading breaks the games' terms of service and is not allowed on PUBG Store."],
  ["Is PUBG Store official?", "No. We're an independent marketplace and are not affiliated with KRAFTON, PUBG Corporation or Tencent."],
];

export default async function SupportPage(props: PageProps<"/support">) {
  const sp = await props.searchParams;
  const user = await getCurrentUser();
  const tickets = user ? await db.supportTicket.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }) : [];
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <div>
        <PageTitle title="Support" subtitle="Answers to common questions, or message our team." />
        <div className="space-y-2">
          {FAQ.map(([q, a]) => (
            <details key={q} className="card group p-4 open:border-neon/40">
              <summary className="cursor-pointer list-none font-semibold marker:hidden">{q}</summary>
              <p className="mt-2 text-sm text-zinc-300">{a}</p>
            </details>
          ))}
        </div>
        {tickets.length > 0 && (
          <section className="mt-6">
            <h2 className="heading mb-3 text-lg">Your tickets</h2>
            <ul className="space-y-2">
              {tickets.map((t) => (
                <li key={t.id} className="card p-4">
                  <div className="flex items-center justify-between gap-2"><p className="font-semibold">{t.subject}</p><StatusBadge status={t.status} /></div>
                  {t.adminReply && <p className="mt-2 rounded-lg bg-panel-2 p-3 text-sm text-zinc-300"><span className="text-neon">Support:</span> {t.adminReply}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <aside className="card h-fit p-5">
        <h2 className="heading mb-4 text-lg">Contact us</h2>
        <SupportForm email={user?.email} orderRef={typeof sp.order === "string" ? sp.order : undefined} />
      </aside>
    </div>
  );
}
