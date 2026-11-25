"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@hkfinhub/ui";
import { getSession } from "@/lib/auth";

interface ManualBalance {
  configured: boolean;
  held?: { amount: number; currency: string };
  equivalents?: { HKD: number | null; INR: number | null; USD: number | null };
  rateDate?: string | null;
}

const LOCALE: Record<string, string> = { HKD: "en-HK", INR: "en-IN", USD: "en-US" };
const money = (amount: number, currency: string) =>
  new Intl.NumberFormat(LOCALE[currency] ?? "en-US", { style: "currency", currency }).format(amount);

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

  if (!data?.configured || !data.held || !data.equivalents) return null;
  const { held, equivalents, rateDate } = data;
  const rows: { code: string; value: number | null; isHeld: boolean }[] = [
    { code: "USD", value: equivalents.USD, isHeld: held.currency === "USD" },
    { code: "HKD", value: equivalents.HKD, isHeld: held.currency === "HKD" },
    { code: "INR", value: equivalents.INR, isHeld: held.currency === "INR" },
  ];
  return (
    <>
      {rows.map((r) => (
        <Card key={r.code}>
          <CardHeader><CardTitle>{r.code} balance</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-semibold tabular-nums sm:text-4xl">
              {r.isHeld ? money(held.amount, held.currency) : r.value !== null ? money(r.value, r.code) : "Not available"}
            </p>
            {!r.isHeld && r.value !== null && (
              <p className="text-xs text-[var(--muted-foreground)]">
                Converted from {money(held.amount, held.currency)} at the ECB reference rate{rateDate ? ` for ${rateDate}` : ""}. Not held in {r.code}.
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </>
  );
}
