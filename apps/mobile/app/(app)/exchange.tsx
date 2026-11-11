import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { api, formatMoney, parseToMinor } from "@hkfinhub/api-client";
import { CURRENCIES, type CurrencyCode, type FxQuote, type PortfolioPoint } from "@hkfinhub/types";
import { AreaChart } from "@/components/chart";
import { Button, Card, Chip, Field, Muted, Row, Screen, Title } from "@/components/ui";
import { useTheme } from "@/theme/theme";

function Picker({ label, value, onChange }: { label: string; value: CurrencyCode; onChange: (c: CurrencyCode) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {CURRENCIES.map((c) => <Chip key={c} label={c} selected={value === c} onPress={() => onChange(c)} />)}
      </View>
    </View>
  );
}

export default function ExchangeScreen() {
  const [from, setFrom] = useState<CurrencyCode>("HKD");
  const [to, setTo] = useState<CurrencyCode>("USD");
  const [amount, setAmount] = useState("1000");
  const [quote, setQuote] = useState<FxQuote | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [history, setHistory] = useState<PortfolioPoint[]>([]);
  const minor = parseToMinor(amount, from);
  const { colors } = useTheme();

  useEffect(() => {
    if (!minor || BigInt(minor) <= 0n || from === to) { setQuote(null); return; }
    let live = true;
    setErr(null);
    api.getFxQuote(from, to, minor)
      .then((q) => live && setQuote(q))
      .catch((e: unknown) => live && (setQuote(null), setErr(e instanceof Error ? e.message : "No quote.")));
    return () => { live = false; };
  }, [minor, from, to]);

  useEffect(() => {
    let live = true;
    api.getFxHistory(from, to).then((h) => live && setHistory(h));
    return () => { live = false; };
  }, [from, to]);

  return (
    <Screen>
      <Title eyebrow="Multi-currency" title="Convert" description="Quotes come from our FX provider. Rates are sample values until that provider is connected." />
      <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Picker label="From" value={from} onChange={setFrom} />
      <Picker label="To" value={to} onChange={setTo} />
      <Card>
        {from === to ? <Muted>Choose two different currencies.</Muted> : quote ? (
          <>
            <Row label="Rate" value={`1 ${quote.from} = ${quote.rate.toFixed(4)} ${quote.to}`} />
            <Row label="Service fee" value={formatMoney(quote.serviceFee)} />
            <Row label="Rate provider" value={quote.provider} />
            <Row label="Recipient gets" value={formatMoney(quote.recipientAmount)} strong />
          </>
        ) : <Text accessibilityRole="alert" style={{ color: err ? colors.destructive : colors.mutedForeground }}>{err ?? "Enter an amount to see the rate."}</Text>}
      </Card>
      <Card>
        <Text style={{ color: colors.foreground, fontWeight: "700" }}>Rate history · {from}/{to}</Text>
        <AreaChart values={history.map((p) => p.value)} height={140} label={`Sample rate history from ${from} to ${to}`} />
        <Muted>Last 30 days, sample series.</Muted>
      </Card>
      <Button variant="outline" onPress={() => { setFrom(to); setTo(from); }}>Swap currencies</Button>
    </Screen>
  );
}
