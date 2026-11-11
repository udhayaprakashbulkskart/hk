import { PageHeader, Section } from "@/components/page";
import { ReceivePanel } from "@/components/receive-panel";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/money";

export default async function ReceivePage() {
  const txns = (await api.listTransactions()).filter((t) => t.kind === "received");
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Payments" title="Receive money" description="Request a payment by QR code or link, or share bank transfer details." />
      <ReceivePanel />
      <Section title="Incoming payments">
        <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          {txns.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0"><p className="truncate font-medium">{t.title}</p><p className="font-mono text-xs text-[var(--muted-foreground)]">{t.reference}</p></div>
              <p className="shrink-0 font-semibold tabular-nums text-[var(--success)]">{formatMoney(t.amount, { sign: true })}</p>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
