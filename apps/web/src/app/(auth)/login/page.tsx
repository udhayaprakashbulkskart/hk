"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Fingerprint } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from "@hkfinhub/ui";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const id = String(data.get("identifier") ?? "").trim();
    const pw = String(data.get("password") ?? "");
    if (!id || pw.length < 1) {
      setError("Enter your email or mobile number and password.");
      return;
    }
    setError(null);
    setBusy(true);
    // Sandbox: no credentials are checked or stored. Continue to the one-time code step.
    router.push("/verify?purpose=login");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1" className="text-xl">Log in to your account</CardTitle>
        <CardDescription>Sandbox preview. Any entry continues to the verification step.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field id="identifier" label="Email or mobile number" hint="Mobile numbers in international format, e.g. +852 5555 0123">
            <Input id="identifier" name="identifier" autoComplete="username" inputMode="email" placeholder="you@example.com" />
          </Field>
          <Field id="password" label="Password">
            <Input id="password" name="password" type="password" autoComplete="current-password" />
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
          <Button variant="outline" className="w-full" disabled title="Available once live sign-in is connected">Continue with Apple</Button>
          <Button variant="outline" className="w-full" disabled title="Available once live sign-in is connected">Continue with Google</Button>
          <p className="flex items-center justify-center gap-2 text-xs text-[var(--muted-foreground)]">
            <Fingerprint className="size-4" aria-hidden="true" /> Biometric sign-in is available in the mobile app.
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
          New to HK FinHub? <Link href="/register" className="font-semibold text-[var(--gold)] hover:underline">Create an account</Link>
        </p>
      </CardContent>
    </Card>
  );
}
