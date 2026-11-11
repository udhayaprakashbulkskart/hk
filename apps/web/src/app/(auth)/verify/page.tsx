"use client";

import Link from "next/link";
import { useEffect, useRef, useState, Suspense, type ClipboardEvent, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@hkfinhub/ui";
import { authClient, messageFor } from "@/lib/auth";

const LENGTH = 6;
type Step = "EMAIL" | "SMS";

function VerifyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const [step, setStep] = useState<Step>("EMAIL");
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [seconds, setSeconds] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  if (!email) {
    return (
      <Card>
        <CardHeader><CardTitle as="h1" className="text-xl">Verification</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">Start by creating an account, or log in if you have already verified.</p>
          <Link href="/register" className="font-semibold text-[var(--gold)] hover:underline">Create an account</Link>
        </CardContent>
      </Card>
    );
  }

  function setAt(i: number, v: string) {
    const next = [...digits];
    next[i] = v;
    setDigits(next);
  }

  function onKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  }

  function onChange(i: number, raw: string) {
    const v = raw.replace(/\D/g, "");
    if (!v) return setAt(i, "");
    if (v.length > 1) {
      const next = [...digits];
      v.slice(0, LENGTH - i).split("").forEach((c, k) => (next[i + k] = c));
      setDigits(next);
      refs.current[Math.min(i + v.length, LENGTH - 1)]?.focus();
      return;
    }
    setAt(i, v);
    if (i < LENGTH - 1) refs.current[i + 1]?.focus();
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const v = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!v) return;
    setDigits(Array.from({ length: LENGTH }, (_, k) => v[k] ?? ""));
    refs.current[Math.min(v.length, LENGTH - 1)]?.focus();
  }

  async function onVerify() {
    const code = digits.join("");
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code.");
    setError(null);
    setBusy(true);
    try {
      const out = await authClient.verifyOtp({ email, channel: step, code });
      if (step === "EMAIL") {
        setStep("SMS");
        setDigits(Array(LENGTH).fill(""));
        setSeconds(30);
      } else if (out.accountActive) {
        router.push("/login?verified=1");
      }
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    try {
      await authClient.resendOtp({ email, channel: step });
      setSeconds(30);
    } catch (err) {
      setError(messageFor(err));
    }
  }

  return (
    <Card>
      <CardHeader>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">Step {step === "EMAIL" ? 1 : 2} of 2</p>
        <CardTitle as="h1" className="text-xl">{step === "EMAIL" ? "Enter the code sent to your email" : "Enter the code sent to your mobile"}</CardTitle>
        <CardDescription>Codes expire after five minutes. Never share them with anyone.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <fieldset>
          <legend className="sr-only">One-time code</legend>
          <div className="flex justify-between gap-2">
            {digits.map((d, i) => (
              <input
                key={`${step}-${i}`}
                ref={(el) => { refs.current[i] = el; }}
                value={d}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                aria-label={`Digit ${i + 1} of ${LENGTH}`}
                maxLength={1}
                onChange={(e) => onChange(i, e.target.value)}
                onKeyDown={(e) => onKey(i, e)}
                onPaste={onPaste}
                className="h-14 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--secondary)] text-center text-xl font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              />
            ))}
          </div>
        </fieldset>
        {error ? <p role="alert" className="text-sm text-[var(--destructive)]">{error}</p> : null}
        <Button size="lg" className="w-full" onClick={onVerify} disabled={busy}>{step === "EMAIL" ? "Continue" : "Verify and finish"}</Button>
        <p className="text-center text-sm text-[var(--muted-foreground)]">
          {seconds > 0 ? (
            <>Resend code in <span className="tabular-nums">{seconds}s</span></>
          ) : (
            <button type="button" className="font-semibold text-[var(--gold)] hover:underline" onClick={onResend}>Resend code</button>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted-foreground)]">Loading…</p>}>
      <VerifyInner />
    </Suspense>
  );
}
