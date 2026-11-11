import { Download, FileText } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@hkfinhub/ui";
import { PageHeader } from "@/components/page";

const STATEMENTS = [
  { period: "October 2026", kind: "Account statement", ready: true },
  { period: "September 2026", kind: "Account statement", ready: true },
  { period: "Q3 2026", kind: "Investment statement", ready: true },
  { period: "2025 annual", kind: "Tax summary", ready: false },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Documents" title="Statements" description="Account and investment statements. Downloads are issued for your verified account." />
      <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        {STATEMENTS.map((s) => (
          <li key={s.period + s.kind} className="flex items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="size-5 shrink-0 text-[var(--gold)]" aria-hidden="true" />
              <div className="min-w-0"><p className="font-medium">{s.kind}</p><p className="text-sm text-[var(--muted-foreground)]">{s.period}</p></div>
            </div>
            {s.ready ? (
              <Button variant="outline" size="sm" disabled title="Available once live statements are issued"><Download className="size-3.5" aria-hidden="true" />PDF</Button>
            ) : (
              <Badge tone="neutral">Not yet issued</Badge>
            )}
          </li>
        ))}
      </ul>
      <Card><CardContent className="p-4 text-sm text-[var(--muted-foreground)]">No statements are available yet.</CardContent></Card>
    </div>
  );
}
