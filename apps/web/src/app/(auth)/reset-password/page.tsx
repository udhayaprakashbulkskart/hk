"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from "@hkfinhub/ui";

export default function ResetPasswordPage() {
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Same message whether or not the address exists, to avoid revealing registered accounts.
    setSent(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1" className="text-xl">Reset your password</CardTitle>
        <CardDescription>Enter your registered email. If an account exists, we will send a secure reset link.</CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div role="status" className="space-y-4">
            <p className="text-sm">If an account exists for that address, a reset link is on its way. The link expires in 30 minutes.</p>
            <Link href="/login" className="font-semibold text-[var(--gold)] hover:underline">Back to log in</Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <Field id="email" label="Email"><Input id="email" name="email" type="email" required autoComplete="email" /></Field>
            <Button type="submit" size="lg" className="w-full">Send reset link</Button>
            <p className="text-center text-sm"><Link href="/login" className="text-[var(--muted-foreground)] hover:underline">Back to log in</Link></p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
