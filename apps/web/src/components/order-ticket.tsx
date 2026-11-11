"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, cn } from "@hkfinhub/ui";

/** Buy and sell ticket. Submission is disabled until a licensed broker partner is connected. */
export function OrderTicket({ symbol, price, currency }: { symbol: string; price: number; currency: string }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState("");
  const [limit, setLimit] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trade {symbol}</CardTitle>
        <CardDescription>Reference price {price.toLocaleString("en-US", { minimumFractionDigits: 2 })} {currency}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div role="radiogroup" aria-label="Order side" className="grid grid-cols-2 gap-2">
          {(["buy", "sell"] as const).map((s) => (
            <label key={s} className={cn("flex min-h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold capitalize", side === s ? (s === "buy" ? "border-[var(--success)] bg-[var(--success)]/15 text-[var(--success)]" : "border-[var(--destructive)] bg-[var(--destructive)]/15 text-[var(--destructive)]") : "border-[var(--border)]")}>
              <input type="radio" name="side" value={s} checked={side === s} onChange={() => setSide(s)} className="sr-only" />
              {s}
            </label>
          ))}
        </div>
        <Field id="qty" label="Quantity"><Input id="qty" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} /></Field>
        <Field id="limit" label="Limit price (optional)" hint="Leave blank for a market order."><Input id="limit" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} /></Field>
        <div className="flex items-start gap-2 rounded-lg bg-[var(--gold)]/10 p-3 text-xs text-[var(--foreground)]">
          <Info className="mt-0.5 size-4 shrink-0 text-[var(--gold)]" aria-hidden="true" />
          <span>Trading is not yet enabled. Orders go live after our brokerage partner approves your investment account. No order is placed.</span>
        </div>
        <Button className="w-full" disabled>{side === "buy" ? "Place buy order" : "Place sell order"}</Button>
      </CardContent>
    </Card>
  );
}
