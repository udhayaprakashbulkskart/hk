"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Fingerprint } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from "@hkfinhub/ui";
import { authClient, WEB_DEVICE, setSession, messageFor } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim() || !password) return setError("Enter your email and password.");
    setError(null);
    setBusy(true);
    try {
      const out = await authClient.login({ email: email.trim(), password, device: WEB_DEVICE });
      if (out.status === "mfa_required") {
        setMfaToken(out.mfaToken);
      } else {
        setSession(out.tokens);
        router.push("/dashboard");
      }
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  async function onMfa(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const code = String(data.get("code") ?? "").replace(/\s/g, "");
    const recovery = String(data.get("recovery") ?? "").trim();
    if (!/^\d{6}$/.test(code) && recovery.length < 8) return setError("Enter the 6-digit code or a recovery code.");
    setError(null);
    setBusy(true);
    try {
      const out = await authClient.loginMfa(
        /^\d{6}$/.test(code) ? { mfaToken: mfaToken!, code, device: WEB_DEVICE } : { mfaToken: mfaToken!, recoveryCode: recovery, device: WEB_DEVICE },
      );
      if (out.status === "authenticated") {
        setSession(out.tokens);
        router.push("/dashboard");
      }
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  if (mfaToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle as="h1" className="text-xl">Two-step verification</CardTitle>
          <CardDescription>Enter the 6-digit code from your authenticator app, or one of your recovery codes.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onMfa} className="space-y-4" noValidate>
            <Field id="code" label="Authenticator code"><Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} /></Field>
            <Field id="recovery" label="Or a recovery code" hint="Each recovery code works once."><Input id="recovery" name="recovery" autoComplete="off" spellCheck={false} /></Field>
            {error ? <p role="alert" className="text-sm text-[var(--destructive)]">{error}</p> : null}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>Continue</Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1" className="text-xl">Log in to your account</CardTitle>
        <CardDescription>Log in with your email address and password.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onLogin} noValidate className="space-y-4">
          <Field id="email" label="Email" hint="Mobile-number log in is coming soon.">
            <Input id="email" name="email" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Field id="password" label="Password">
            <Input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error ? <p role="alert" className="text-sm text-[var(--destructive)]">{error}</p> : null}
          <div className="flex justify-end">
            <Link href="/reset-password" className="text-sm font-medium text-[var(--gold)] hover:underline">Forgot password?</Link>
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>Log in</Button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
          <span className="h-px flex-1 bg-[var(--border)]" /> or <span className="h-px flex-1 bg-[var(--border)]" />
        </div>
        <div className="space-y-3">
          <Button variant="outline" className="w-full" disabled title="Available once social sign-in is approved">Continue with Apple</Button>
          <Button variant="outline" className="w-full" disabled title="Available once social sign-in is approved">Continue with Google</Button>
          <p className="flex items-center justify-center gap-2 text-xs text-[var(--muted-foreground)]">
            <Fingerprint className="size-4" aria-hidden="true" /> Biometric sign-in is available in the mobile app.
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
        </p>
      </CardContent>
    </Card>
  );
}
