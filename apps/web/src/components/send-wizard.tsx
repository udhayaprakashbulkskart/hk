"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3 } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, cn } from "@hkfinhub/ui";
import { CURRENCIES, type Beneficiary, type CurrencyCode, type FxQuote, type TransferReceipt } from "@hkfinhub/types";
import { api } from "@/lib/api";
import { formatMoney, parseToMinor } from "@/lib/money";

type Method = "upi" | "bank" | "swift";
type Step = "recipient" | "amount" | "review" | "confirm" | "result";
const STEPS: Step[] = ["recipient", "amount", "review", "confirm"];
const METHOD_LABEL: Record<Method, string> = { upi: "UPI ID", bank: "Bank account", swift: "SWIFT / IBAN" };

export function SendWizard({ beneficiaries }: { beneficiaries: Beneficiary[] }) {
  const [step, setStep] = useState<Step>("recipient");
  const [method, setMethod] = useState<Method>("swift");
  const [beneficiaryId, setBeneficiaryId] = useState<string>(beneficiaries[0]?.id ?? "new");
  const [newName, setNewName] = useState("");
  const [newDest, setNewDest] = useState("");
  const [newCountry, setNewCountry] = useState("SG");
  const [amountInput, setAmountInput] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("SGD");
  const [quote, setQuote] = useState<FxQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<TransferReceipt | null>(null);
  const [busy, setBusy] = useState(false);
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const beneficiary = beneficiaries.find((b) => b.id === beneficiaryId);
  const recipientName = beneficiaryId === "new" ? newName : beneficiary?.name ?? "";
  const destination = beneficiaryId === "new" ? newDest : beneficiary?.destination ?? "";
  const amountMinor = parseToMinor(amountInput, "HKD");

  useEffect(() => {
    if (!amountMinor || BigInt(amountMinor) <= 0n) { setQuote(null); return; }
    let live = true;
    setQuoteError(null);
    api.getFxQuote("HKD", currency, amountMinor)
      .then((q) => live && (setQuote(q), setQuoteError(q ? null : "Live rates are not connected yet.")))
      .catch((e: unknown) => live && (setQuote(null), setQuoteError(e instanceof Error ? e.message : "Quote unavailable")));
    return () => { live = false; };
  }, [amountMinor, currency]);

  function next() {
    setError(null);
    if (step === "recipient") {
      if (!recipientName.trim() || !destination.trim()) return setError("Choose a saved recipient or enter the recipient details.");
      setStep("amount");
    } else if (step === "amount") {
      if (!amountMinor || BigInt(amountMinor) <= 0n) return setError("Enter an amount greater than zero, using up to two decimal places.");
      if (!quote) return setError(quoteError ?? "Wait for the rate quote before continuing.");
      setStep("review");
    } else if (step === "review") {
      setStep("confirm");
    }
  }

  async function submit() {
    setError(null);
    if (!/^\d{6}$/.test(otp)) return setError("Enter the 6-digit code from your authenticator app.");
    if (!confirmed) return setError("Confirm the recipient and amount before submitting.");
    setBusy(true);
    try {
      const r = await api.submitTransfer({ beneficiaryId: beneficiaryId === "new" ? "new" : beneficiaryId, amountMinor: amountMinor!, currency, idempotencyKey });
      setReceipt(r);
      setStep("result");
    } catch {
      setError("We could not submit this transfer. Nothing has been sent. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const index = STEPS.indexOf(step as Step);

  if (step === "result" && receipt) {
    return (
      <Card>
        <CardHeader>
          {receipt.status === "failed" ? (
            <div className="flex items-center gap-2 text-[var(--destructive)]"><span className="text-sm font-semibold">Transfer not sent</span></div>
          ) : (
            <div className="flex items-center gap-2 text-[var(--gold)]"><Clock3 className="size-5" aria-hidden="true" /><span className="text-sm font-semibold">Instruction recorded</span></div>
          )}
          <CardTitle className="text-xl">{receipt.status === "failed" ? "No money has moved" : "Transfer pending confirmation"}</CardTitle>
          <CardDescription>{receipt.message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 rounded-xl bg-[var(--secondary)] p-4 text-sm sm:grid-cols-2">
            <div><dt className="text-[var(--muted-foreground)]">Reference</dt><dd className="font-mono font-medium">{receipt.reference}</dd></div>
            <div><dt className="text-[var(--muted-foreground)]">Status</dt><dd><Badge tone="gold">Pending</Badge></dd></div>
            <div><dt className="text-[var(--muted-foreground)]">Recipient</dt><dd className="font-medium">{recipientName}</dd></div>
            <div><dt className="text-[var(--muted-foreground)]">You send</dt><dd className="font-medium tabular-nums">{formatMoney({ amountMinor: amountMinor!, currency: "HKD" })}</dd></div>
            <div><dt className="text-[var(--muted-foreground)]">Recipient gets</dt><dd className="font-medium tabular-nums">{quote ? formatMoney(quote.recipientAmount) : "—"}</dd></div>
          </dl>
          <p className="text-xs text-[var(--muted-foreground)]">No money has moved. Your balance updates only after the payment partner confirms the transfer.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a href="/history" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)]">View transaction</a>
            <a href="/send" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--border)] px-4 text-sm font-medium">Send another</a>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <ol className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={s === step ? "step" : undefined} className="flex items-center gap-2">
              <span className={cn("flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold", i <= index ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]" : "border-[var(--border)]")}>{i + 1}</span>
              <span className={cn("hidden capitalize sm:inline", s === step && "font-medium text-[var(--foreground)]")}>{s}</span>
              {i < STEPS.length - 1 ? <span className="h-px w-4 bg-[var(--border)] sm:w-8" aria-hidden="true" /> : null}
            </li>
          ))}
        </ol>
        <CardTitle className="pt-2 text-xl">
          {step === "recipient" && "Who are you sending to?"}
          {step === "amount" && "How much?"}
          {step === "review" && "Review your transfer"}
          {step === "confirm" && "Confirm and authorise"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {step === "recipient" && (
          <>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">Transfer method</legend>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(METHOD_LABEL) as Method[]).map((m) => (
                  <label key={m} className={cn("flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-2 text-center text-sm", method === m ? "border-[var(--primary)] bg-[var(--primary)]/10 font-medium" : "border-[var(--border)]")}>
                    <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
                    {METHOD_LABEL[m]}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field id="beneficiary" label="Recipient">
              <select id="beneficiary" value={beneficiaryId} onChange={(e) => setBeneficiaryId(e.target.value)} className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-base sm:text-sm">
                {beneficiaries.map((b) => <option key={b.id} value={b.id}>{b.name} · {b.destination}</option>)}
                <option value="new">+ New recipient</option>
              </select>
            </Field>
            {beneficiaryId === "new" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="new-name" label="Recipient full name"><Input id="new-name" value={newName} onChange={(e) => setNewName(e.target.value)} autoComplete="off" /></Field>
                <Field id="new-country" label="Recipient country">
                  <select id="new-country" value={newCountry} onChange={(e) => setNewCountry(e.target.value)} className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-base sm:text-sm">
                    <option value="SG">Singapore</option><option value="IN">India</option><option value="CN">China</option><option value="GB">United Kingdom</option><option value="AE">United Arab Emirates</option><option value="US">United States</option>
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field id="new-dest" label={method === "upi" ? "UPI ID" : method === "bank" ? "Account number" : "SWIFT / BIC and IBAN"} hint={method === "swift" ? "We never ask for online banking passwords or card CVVs." : undefined}>
                    <Input id="new-dest" value={newDest} onChange={(e) => setNewDest(e.target.value)} autoComplete="off" spellCheck={false} />
                  </Field>
                </div>
                <p className="text-xs text-[var(--muted-foreground)] sm:col-span-2">Recipient country: {newCountry}. Destination is verified by our payment partner before payout.</p>
              </div>
            ) : null}
          </>
        )}

        {step === "amount" && (
          <>
            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <Field id="amount" label="You send (HKD)" hint="Up to two decimal places.">
                <Input id="amount" inputMode="decimal" placeholder="0.00" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} className="text-lg tabular-nums" />
              </Field>
              <Field id="currency" label="Recipient currency">
                <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)} className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-base sm:text-sm">
                  {CURRENCIES.filter((c) => c !== "HKD").map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <QuoteBox quote={quote} error={quoteError} />
          </>
        )}

        {step === "review" && quote && (
          <dl className="space-y-3 rounded-xl bg-[var(--secondary)] p-4 text-sm">
            <Row k="Recipient" v={recipientName} />
            <Row k="Method" v={METHOD_LABEL[method]} />
            <Row k="Destination" v={destination} />
            <Row k="You send" v={formatMoney({ amountMinor: amountMinor!, currency: "HKD" })} />
            <Row k="Service fee" v={formatMoney(quote.serviceFee)} />
            <Row k="Exchange rate" v={`1 HKD = ${quote.rate.toFixed(4)} ${currency}`} />
            <Row k="Recipient gets" v={formatMoney(quote.recipientAmount)} strong />
            <Row k="Rate provider" v={quote.provider} />
          </dl>
        )}

        {step === "confirm" && (
          <>
            <Field id="otp" label="Authenticator code" hint="Enter the 6-digit code from your authenticator app.">
              <Input id="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} className="tracking-[0.4em] tabular-nums" />
            </Field>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 size-4 accent-[var(--primary)]" />
              <span>I have checked the recipient and amount. I understand the transfer stays pending until our payment partner confirms it.</span>
            </label>
          </>
        )}

        {error ? <p role="alert" className="text-sm text-[var(--destructive)]">{error}</p> : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {index > 0 ? (
            <Button variant="outline" onClick={() => setStep(STEPS[index - 1]!)}>Back</Button>
          ) : <span />}
          {step === "confirm" ? (
            <Button onClick={submit} disabled={busy || !confirmed || otp.length !== 6}>{busy ? "Submitting…" : "Submit transfer"}</Button>
          ) : (
            <Button onClick={next}>Continue</Button>
          )}
        </div>
        {step === "confirm" ? <p className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]"><CheckCircle2 className="size-4 text-[var(--success)]" aria-hidden="true" />Live transfers are not yet enabled. This submits an instruction only.</p> : null}
      </CardContent>
    </Card>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-[var(--muted-foreground)]">{k}</dt>
      <dd className={cn("text-right tabular-nums", strong && "font-semibold text-[var(--foreground)]")}>{v}</dd>
    </div>
  );
}

export function QuoteBox({ quote, error }: { quote: FxQuote | null; error: string | null }) {
  if (error) return <p role="alert" className="text-sm text-[var(--destructive)]">{error}</p>;
  if (!quote) return <p className="text-sm text-[var(--muted-foreground)]" aria-live="polite">Enter an amount to see the rate, fees and the amount your recipient gets.</p>;
  return (
    <dl aria-live="polite" className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 text-sm sm:grid-cols-2">
      <Row k="Exchange rate" v={`1 ${quote.from} = ${quote.rate.toFixed(4)} ${quote.to}`} />
      <Row k="Service fee" v={formatMoney(quote.serviceFee)} />
      <Row k="Rate provider" v={quote.provider} />
      <Row k="Quoted at" v={new Date(quote.quotedAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Hong_Kong", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " HKT"} />
      <Row k="Quote valid for" v="30 seconds" />
      <Row k="Recipient gets" v={formatMoney(quote.recipientAmount)} strong />
    </dl>
  );
}


