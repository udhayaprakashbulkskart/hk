"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@hkfinhub/ui";
import { getSession } from "@/lib/auth";

interface ManualBalance {
  configured: boolean;
  amount?: number;
  currency?: string;
  hkdEquivalent?: number | null;
  rateDate?: string | null;
}

/** Owner-only. Fetched with the login token, so nothing is shown to anyone who is not signed in. */
export function ManualBalanceCard() {
  const [data, setData] = useState<ManualBalance | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) return;
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    fetch(`${base}/v1/accounts/manual-balance`, {
      headers: { authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    })
      .then(async (res) => {
        if (res.ok) setData((await res.json()) as ManualBalance);
      })
      .catch(() => undefined);
  }, []);

  if (!data?.configured || data.amount === undefined || !data.currency) return null;
  const money = (amount: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  return (
    <Card>
      <CardHeader><CardTitle>Balance</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <p className="text-3xl font-semibold tabular-nums sm:text-4xl">{money(data.amount, data.currency)}</p>
        {data.hkdEquivalent !== null && data.hkdEquivalent !== undefined && (
          <p className="text-sm text-[var(--muted-foreground)] tabular-nums">
            ≈ {money(data.hkdEquivalent, "HKD")}
            {data.rateDate ? ` at the ECB reference rate for ${data.rateDate}` : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
