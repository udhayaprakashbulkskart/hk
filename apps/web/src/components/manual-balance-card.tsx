"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@hkfinhub/ui";
import { getSession } from "@/lib/auth";

/** Owner-only. Fetched with the login token, so nothing is shown to anyone who is not signed in. */
export function ManualBalanceCard() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) return;
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    fetch(`${base}/v1/accounts/manual-balance`, {
      headers: { authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json()) as { configured: boolean; amount?: number };
        if (body.configured && typeof body.amount === "number") {
          setText(new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(body.amount));
        }
      })
      .catch(() => undefined);
  }, []);

  if (!text) return null;
  return (
    <Card>
      <CardHeader><CardTitle>Balance</CardTitle></CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums sm:text-4xl">{text}</p>
      </CardContent>
    </Card>
  );
}
