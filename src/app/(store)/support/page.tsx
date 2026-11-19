import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SupportForm } from "@/components/forms/account-forms";
import { StatusBadge } from "@/components/ui/badges";
import { PageTitle } from "@/components/ui/section";
import { FAQ as ALL_FAQ } from "@/lib/content/faq";

export const metadata: Metadata = { title: "Support" };

const FAQ = ALL_FAQ.flatMap((g) => g.items).slice(0, 6);

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
