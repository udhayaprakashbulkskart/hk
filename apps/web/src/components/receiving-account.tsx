"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@hkfinhub/ui";
import { getSession } from "@/lib/auth";

interface ReceivingAccount {
  configured: boolean;
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
}

/** Shows the operator's receiving account. Fetched with the login token, so it is never public. */
export function ReceivingAccountCard() {
  const [state, setState] = useState<{ status: "loading" | "signed-out" | "ready" | "error"; data?: ReceivingAccount }>({ status: "loading" });

  useEffect(() => {
    const session = getSession();
    if (!session) {
      setState({ status: "signed-out" });
      return;
    }
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    fetch(`${base}/v1/accounts/receiving-account`, {
      headers: { authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        setState({ status: "ready", data: (await res.json()) as ReceivingAccount });
      })
      .catch(() => setState({ status: "error" }));
  }, []);

  return (
    <Card>
      <CardHeader><CardTitle>Receiving account</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {state.status === "loading" && <p className="text-[var(--muted-foreground)]">Loading…</p>}
        {state.status === "signed-out" && (
          <p className="text-[var(--muted-foreground)]">
            <Link href="/login" className="text-[var(--gold)] hover:underline">Log in</Link> to see your receiving account.
          </p>
        )}
        {state.status === "error" && <p className="text-[var(--muted-foreground)]">Could not load the receiving account. Log in again and retry.</p>}
        {state.status === "ready" && !state.data?.configured && (
          <p className="text-[var(--muted-foreground)]">Not set up yet.</p>
        )}
        {state.status === "ready" && state.data?.configured && (
          <dl className="grid gap-2 sm:grid-cols-2">
            <div><dt className="text-[var(--muted-foreground)]">Account holder</dt><dd className="font-medium">{state.data.accountName}</dd></div>
            <div><dt className="text-[var(--muted-foreground)]">Account number</dt><dd className="font-mono font-medium">{state.data.accountNumber}</dd></div>
            <div className="sm:col-span-2"><dt className="text-[var(--muted-foreground)]">Bank</dt><dd className="font-medium">{state.data.bankName}</dd></div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
