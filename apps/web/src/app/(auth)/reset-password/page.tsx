"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from "@hkfinhub/ui";
import { authClient, messageFor } from "@/lib/auth";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onRequest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError("Enter a valid email address.");
    setError(null);
    setBusy(true);
    try {
      // Same answer for every address, so this cannot reveal which emails are registered.
      await authClient.requestPasswordReset(email);
      setRequested(true);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const code = String(d.get("code") ?? "").replace(/\s/g, "");
    const newPassword = String(d.get("newPassword") ?? "");
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code from the email.");
    if (newPassword.length < 12) return setError("Password must be at least 12 characters.");
    setError(null);
    setBusy(true);
    try {
      await authClient.confirmPasswordReset({ email, code, newPassword });
      router.push("/login?reset=1");
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1" className="text-xl">Reset your password</CardTitle>
        <CardDescription>{requested ? "If an account exists for that address, we have sent a code. It expires in five minutes." : "Enter your registered email. If an account exists, we will send a secure code."}</CardDescription>
      </CardHeader>
      <CardContent>
        {!requested ? (
          <form onSubmit={onRequest} className="space-y-4" noValidate>
            <Field id="email" label="Email"><Input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            {error ? <p role="alert" className="text-sm text-[var(--destructive)]">{error}</p> : null}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>Send reset code</Button>
            <p className="text-center text-sm"><Link href="/login" className="text-[var(--muted-foreground)] hover:underline">Back to log in</Link></p>
          </form>
        ) : (
          <form onSubmit={onConfirm} className="space-y-4" noValidate>
            <Field id="code" label="Code from email"><Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} /></Field>
            <Field id="newPassword" label="New password" hint="At least 12 characters. Ends all your active sessions."><Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" /></Field>
            {error ? <p role="alert" className="text-sm text-[var(--destructive)]">{error}</p> : null}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>Set new password</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
