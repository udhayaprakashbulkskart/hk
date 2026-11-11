"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Badge } from "@hkfinhub/ui";
import { CURRENCIES, type CurrencyCode } from "@hkfinhub/types";
import { parseToMinor, formatMoney } from "@/lib/money";

/** Builds a payment request. The link and QR code are placeholders until live payment collection is approved. */
export function ReceivePanel() {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("HKD");
  const [memo, setMemo] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Generated after mount: random values in render would differ between server and client (hydration mismatch).
  const [reference, setReference] = useState<string | null>(null);
  useEffect(() => {
    setReference(`REQ-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
  }, []);
  const link = reference ? `https://pay.hkfinhub.example/r/${reference}` : "";
  const minor = parseToMinor(amount, currency);

  useEffect(() => {
    if (!link) return;
    let live = true;
    QRCode.toDataURL(link, { margin: 1, width: 224, errorCorrectionLevel: "M", color: { dark: "#11141a", light: "#ffffff" } })
      .then((url) => live && setQr(url))
      .catch(() => live && setQr(null));
    return () => { live = false; };
  }, [link]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Create a payment request</CardTitle>
          <CardDescription>Share a link or QR code. A payment counts only after the provider confirms it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <Field id="req-amount" label="Amount (optional)" hint="Leave blank to let the payer choose.">
              <Input id="req-amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field id="req-currency" label="Currency">
              <select id="req-currency" value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)} className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-base sm:text-sm">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field id="req-memo" label="Note for the payer (optional)">
            <Input id="req-memo" maxLength={80} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="e.g. Dinner split" />
          </Field>
          {amount && !minor ? <p role="alert" className="text-sm text-[var(--destructive)]">Enter an amount with up to two decimal places.</p> : null}
          <div className="rounded-xl bg-[var(--secondary)] p-4 text-sm">
            <p className="text-[var(--muted-foreground)]">Requested</p>
            <p className="text-lg font-semibold tabular-nums">{minor ? formatMoney({ amountMinor: minor, currency }) : "Any amount"}</p>
            {memo ? <p className="mt-1 text-[var(--muted-foreground)]">{memo}</p> : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={copy} className="sm:flex-1"><Copy className="size-4" aria-hidden="true" />{copied ? "Copied" : "Copy link"}</Button>
            <Button variant="gold" className="sm:flex-1" disabled title="Available when live payment collection is enabled">Share request</Button>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">This is not yet a live payment page.</p>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>QR code</CardTitle>
            <CardDescription>Reference {reference ?? "…"}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="rounded-2xl bg-white p-4">
              {qr && reference ? <img src={qr} width={224} height={224} alt={`QR code for payment request ${reference}`} /> : <div className="flex size-56 items-center justify-center text-sm text-[var(--muted-foreground)]">Generating…</div>}
            </div>
            <p className="break-all text-center font-mono text-xs text-[var(--muted-foreground)]">{link || "…"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bank transfer instructions</CardTitle>
            <CardDescription>Your receiving details are issued when your account is verified.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-[var(--muted-foreground)]">Account name</dt><dd className="font-medium">Issued after verification</dd></div>
              <div><dt className="text-[var(--muted-foreground)]">Reference to quote</dt><dd className="font-mono font-medium">{reference ?? "…"}</dd></div>
              <div><dt className="text-[var(--muted-foreground)]">Receiving account</dt><dd><Badge tone="gold">Issued after verification</Badge></dd></div>
              <div><dt className="text-[var(--muted-foreground)]">Incoming payments</dt><dd>Credited after partner confirmation</dd></div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
