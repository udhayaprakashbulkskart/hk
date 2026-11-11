"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, cn } from "@hkfinhub/ui";
import { CURRENCIES, type CurrencyCode, type FxQuote, type PortfolioPoint } from "@hkfinhub/types";
import { api } from "@/lib/api";
import { formatMoney, parseToMinor } from "@/lib/money";
import { QuoteBox } from "./send-wizard";
import { TrendChart } from "./charts";

function CurrencySelect({ id, label, value, onChange }: { id: string; label: string; value: CurrencyCode; onChange: (c: CurrencyCode) => void }) {
  return (
    <Field id={id} label={label}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as CurrencyCode)} className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-base sm:text-sm">
        {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </Field>
  );
}

/** Currency converter with a live-style quote from the API boundary and a rate history chart. */
export function ExchangeTool({ initialHistory }: { initialHistory: PortfolioPoint[] }) {
  const [from, setFrom] = useState<CurrencyCode>("HKD");
  const [to, setTo] = useState<CurrencyCode>("USD");
  const [amount, setAmount] = useState("1000");
  const [quote, setQuote] = useState<FxQuote | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [history, setHistory] = useState<PortfolioPoint[]>(initialHistory);
  const minor = parseToMinor(amount, from);

  useEffect(() => {
    if (!minor || BigInt(minor) <= 0n || from === to) { setQuote(null); return; }
    let live = true;
    setErr(null);
    api.getFxQuote(from, to, minor)
      .then((q) => live && (setQuote(q), setErr(q ? null : "Live rates are not connected yet.")))
      .catch((e: unknown) => live && (setQuote(null), setErr(e instanceof Error ? e.message : "No quote available for this pair.")));
    return () => { live = false; };
  }, [minor, from, to]);

  useEffect(() => {
    let live = true;
    api.getFxHistory(from, to).then((h) => live && setHistory(h));
    return () => { live = false; };
  }, [from, to]);

  function swap() { setFrom(to); setTo(from); }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Convert currency</CardTitle>
          <CardDescription>Quotes come from our FX provider. Rates appear once that provider is connected.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field id="fx-amount" label="Amount"><Input id="fx-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg tabular-nums" /></Field>
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <CurrencySelect id="fx-from" label="From" value={from} onChange={setFrom} />
            <Button variant="outline" size="icon" onClick={swap} aria-label="Swap currencies"><ArrowLeftRight className="size-4" aria-hidden="true" /></Button>
            <CurrencySelect id="fx-to" label="To" value={to} onChange={setTo} />
          </div>
          {from === to ? <p className="text-sm text-[var(--muted-foreground)]">Choose two different currencies.</p> : <QuoteBox quote={quote} error={err} />}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Rate history · {from}/{to}</CardTitle>
          <CardDescription>Last 30 days. Each quote shows its provider and timestamp.</CardDescription>
        </CardHeader>
        <CardContent>
          <TrendChart
            ariaLabel={`Exchange rate history for ${from} to ${to}`}
            data={history.map((p) => ({ label: p.date.slice(5), value: p.value }))}
            format={{ kind: "rate", to }}
            height={260}
          />
          {quote ? <p className={cn("mt-3 text-xs text-[var(--muted-foreground)]")}>Converting {formatMoney({ amountMinor: minor!, currency: from })} gives {formatMoney(quote.recipientAmount)} before any recipient-side charges.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

/** Global transfer preview: pick a corridor, see the full cost before starting a SWIFT send. */
export function GlobalTransferTool() {
  const [to, setTo] = useState<CurrencyCode>("GBP");
  const [amount, setAmount] = useState("5000");
  const [quote, setQuote] = useState<FxQuote | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const minor = parseToMinor(amount, "HKD");
  useEffect(() => {
    if (!minor || BigInt(minor) <= 0n) { setQuote(null); return; }
    let live = true;
    setErr(null);
    api.getFxQuote("HKD", to, minor)
      .then((q) => live && (setQuote(q), setErr(q ? null : "Live rates are not connected yet.")))
      .catch((e: unknown) => live && (setQuote(null), setErr(e instanceof Error ? e.message : "No quote available.")));
    return () => { live = false; };
  }, [minor, to]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview an international transfer</CardTitle>
        <CardDescription>Check the full cost first. You confirm everything on the next screen.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="gt-amount" label="You send (HKD)"><Input id="gt-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular-nums" /></Field>
          <CurrencySelect id="gt-to" label="Recipient currency" value={to} onChange={setTo} />
        </div>
        <QuoteBox quote={quote} error={err} />
        <Button className="w-full sm:w-auto" disabled={!quote} onClick={() => { window.location.href = `/send?currency=${to}&amount=${encodeURIComponent(amount)}`; }}>Continue to send</Button>
      </CardContent>
    </Card>
  );
}
