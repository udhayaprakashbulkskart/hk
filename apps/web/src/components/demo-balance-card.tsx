import { Badge, Card, CardContent, CardHeader, CardTitle } from "@hkfinhub/ui";

/** Clearly labelled demo balance. It is not a transaction and no money is held or moved. */
export function DemoBalanceCard() {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Demo balance</CardTitle>
        <Badge tone="gold">DEMO — not real money</Badge>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-2xl font-semibold tabular-nums">USD 1.00</p>
        <p className="text-[var(--muted-foreground)]">
          Demo figure for layout only. It is not a deposit, not a credit and not a transaction. Live payments are not enabled.
        </p>
      </CardContent>
    </Card>
  );
}
