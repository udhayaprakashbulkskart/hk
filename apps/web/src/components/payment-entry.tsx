import { ShieldCheck, Info } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from "@hkfinhub/ui";
import { PageHeader } from "./page";

/** Deposit and withdrawal shell. Forms are disabled until the payment partner is live. */
export function PaymentEntry({ mode }: { mode: "deposit" | "withdraw" }) {
  const isDeposit = mode === "deposit";
  const methods = isDeposit
    ? [
        { name: "Bank transfer (local)", detail: "Pay from your bank to your HK FinHub receiving account. Credited after confirmation." },
        { name: "Debit or credit card", detail: "Entered on the payment provider's secure page. We never see the card number or CVV." },
        { name: "UPI (India)", detail: "Available for INR accounts through our payment partner." },
      ]
    : [
        { name: "Bank account", detail: "Sent to a verified bank account in your name. Debited when the partner confirms." },
        { name: "Local bank payout", detail: "Partner-supported payout to a linked local account." },
      ];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Payments" title={isDeposit ? "Deposit funds" : "Withdraw funds"} description={isDeposit ? "Add money from a linked bank or card." : "Move money from your wallet to a verified bank account."} />
      <div className="flex items-start gap-3 rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 p-4 text-sm">
        <Info className="mt-0.5 size-5 shrink-0 text-[var(--gold)]" aria-hidden="true" />
        <p>Live {isDeposit ? "deposits" : "withdrawals"} are not yet enabled. Amounts and methods below show how the flow will work. Nothing is processed in this sandbox.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Amount</CardTitle>
          <CardDescription>Fees and the exact amount credited are shown before you confirm.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <Field id="pay-amount" label="Amount"><Input id="pay-amount" inputMode="decimal" placeholder="0.00" disabled /></Field>
            <Field id="pay-ccy" label="Currency"><Input id="pay-ccy" value="HKD" readOnly /></Field>
          </div>
          <Button className="w-full sm:w-auto" disabled>{isDeposit ? "Continue to deposit" : "Continue to withdrawal"}</Button>
        </CardContent>
      </Card>
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Methods</h2>
        {methods.map((m) => (
          <Card key={m.name}>
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <div><p className="font-medium">{m.name}</p><p className="text-sm text-[var(--muted-foreground)]">{m.detail}</p></div>
              <Badge tone="neutral">Not yet enabled</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]"><ShieldCheck className="size-4 text-[var(--success)]" aria-hidden="true" />We do not collect bank login passwords, UPI PINs or card CVVs.</p>
    </div>
  );
}
