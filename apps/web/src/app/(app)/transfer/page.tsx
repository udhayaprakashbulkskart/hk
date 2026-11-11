import { PageHeader, Section } from "@/components/page";
import { GlobalTransferTool } from "@/components/quote-tools";
import { Card, CardContent } from "@hkfinhub/ui";

const CORRIDORS = [
  { name: "Hong Kong → Singapore", method: "SWIFT / local bank" },
  { name: "Hong Kong → India", method: "UPI or bank account" },
  { name: "Hong Kong → United Kingdom", method: "SWIFT" },
  { name: "Hong Kong → China", method: "Bank account" },
];

export default function GlobalTransferPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Global transfer" title="Send abroad" description="Pay recipients in other countries through authorised payment partners. Timings are estimates from the partner, not guarantees." />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3"><GlobalTransferTool /></div>
        <div className="space-y-3 lg:col-span-2">
          <Section title="Popular routes">
            {CORRIDORS.map((c) => (
              <Card key={c.name}>
                <CardContent className="space-y-1 p-4">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">{c.method}</p>
                </CardContent>
              </Card>
            ))}
          </Section>
          <p className="text-xs text-[var(--muted-foreground)]">Routes are planned corridors. A route is offered only once our partner has approved it for your account. Timing is confirmed on the quote.</p>
        </div>
      </div>
    </div>
  );
}
