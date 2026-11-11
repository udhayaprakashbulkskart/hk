import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Text } from "react-native";
import { api, formatMoney, parseToMinor } from "@hkfinhub/api-client";
import type { CurrencyCode, FxQuote } from "@hkfinhub/types";
import { CURRENCIES } from "@hkfinhub/types";
import { Button, Card, Chip, Field, Muted, Row, Screen, Title } from "@/components/ui";
import { useTheme } from "@/theme/theme";

export default function GlobalTransferScreen() {
  const { colors } = useTheme();
  const [to, setTo] = useState<CurrencyCode>("GBP");
  const [amount, setAmount] = useState("5000");
  const [quote, setQuote] = useState<FxQuote | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const minor = parseToMinor(amount, "HKD");

  useEffect(() => {
    if (!minor || BigInt(minor) <= 0n) { setQuote(null); return; }
    let live = true;
    setErr(null);
    api.getFxQuote("HKD", to, minor)
      .then((q) => live && setQuote(q))
      .catch((e: unknown) => live && (setQuote(null), setErr(e instanceof Error ? e.message : "No quote.")));
    return () => { live = false; };
  }, [minor, to]);

  return (
    <Screen>
      <Title eyebrow="Global transfer" title="Send abroad" description="Check the full cost first. You confirm everything on the next screen." />
      <Field label="You send (HKD)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Muted>Recipient currency</Muted>
      <Card style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {CURRENCIES.filter((c) => c !== "HKD").map((c) => <Chip key={c} label={c} selected={to === c} onPress={() => setTo(c)} />)}
      </Card>
      <Card>
        {quote ? (
          <>
            <Row label="Exchange rate" value={`1 HKD = ${quote.rate.toFixed(4)} ${to}`} />
            <Row label="Service fee" value={formatMoney(quote.serviceFee)} />
            <Row label="Rate provider" value={quote.provider} />
            <Row label="Quoted at" value={new Date(quote.quotedAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Hong_Kong", hour: "2-digit", minute: "2-digit" }) + " HKT"} />
            <Row label="Recipient gets" value={formatMoney(quote.recipientAmount)} strong />
          </>
        ) : (
          <Text accessibilityRole="alert" style={{ color: err ? colors.destructive : colors.mutedForeground }}>{err ?? "Enter an amount to see the rate and fees."}</Text>
        )}
      </Card>
      <Button disabled={!quote} onPress={() => router.push({ pathname: "/send", params: { amount } })}>Continue to send</Button>
    </Screen>
  );
}
