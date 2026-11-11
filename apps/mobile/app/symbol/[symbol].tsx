import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { api } from "@hkfinhub/api-client";
import { AreaChart } from "@/components/chart";
import { Card, ErrorBox, Loading, Muted, Row, Screen, Notice, Stat } from "@/components/ui";
import { useAsync } from "@/lib/useAsync";
import { useTheme } from "@/theme/theme";

export default function SymbolScreen() {
  const { colors } = useTheme();
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const sym = String(symbol);
  const quote = useAsync(async () => {
    const [list, series] = await Promise.all([api.listMarket(), api.getPriceHistory(sym)]);
    return { q: list.find((m) => m.symbol === sym) ?? null, series };
  }, [sym]);

  if (quote.loading) return <Screen><Loading /></Screen>;
  if (quote.error || !quote.data) return <Screen><ErrorBox message={quote.error ?? "Quote not found."} onRetry={quote.reload} /></Screen>;
  const { q, series } = quote.data;
  if (!q) return <Screen><Muted>No quote for {sym}.</Muted></Screen>;

  return (
    <Screen>
      <Stat label={`${q.symbol} · ${q.market}`} value={`${q.price.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${q.currency}`} sub={`${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}% · delayed sample`} tone={q.changePct >= 0 ? "up" : "down"} />
      <Text accessibilityRole="header" style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>{q.name}</Text>
      <Card>
        <AreaChart values={series.map((p) => p.value)} height={180} tone={q.changePct >= 0 ? "up" : "down"} label={`30-day price chart for ${q.symbol}. Not market data.`} />
        <Muted>Charts appear once a licensed market data feed is connected.</Muted>
      </Card>
      <Notice>Market data only. Trading is not available in this app.</Notice>
    </Screen>
  );
}
