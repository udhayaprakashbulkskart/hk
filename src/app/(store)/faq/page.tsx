import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { FAQ } from "@/lib/content/faq";
import { PageTitle } from "@/components/ui/section";

export const metadata: Metadata = { title: "FAQ", description: "Answers about safety, delivery, UC top-ups, payments and coupons on ZYNOFLIX STORE.", alternates: { canonical: "/faq" } };

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.flatMap((g) => g.items).map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
  return (
    <div className="mx-auto max-w-3xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageTitle title="Frequently asked questions" subtitle="Can't find your answer? Contact our support team." />
      <div className="space-y-8">
        {FAQ.map((g) => (
          <section key={g.group}>
            <h2 className="heading mb-3 text-lg text-neon">{g.group}</h2>
            <div className="space-y-2">
              {g.items.map(([q, a]) => (
                <details key={q} className="card group p-4 open:border-neon">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-[#ffe9b8] marker:hidden">
                    {q} <ChevronDown className="size-4 shrink-0 text-neon transition group-open:rotate-180" />
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-[#f3dcb8]">{a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-10 text-center">
        <Link href="/contact" className="btn-primary">Contact support</Link>
      </div>
    </div>
  );
}
