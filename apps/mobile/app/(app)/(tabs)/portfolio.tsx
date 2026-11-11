import { View, Text } from "react-native";
import { api, formatMoney } from "@hkfinhub/api-client";
import { AreaChart } from "@/components/chart";
import { Badge, Card, ErrorBox, Heading, Loading, Muted, Row, Screen, Stat, Title, Button } from "@/components/ui";
import { useAsync } from "@/lib/useAsync";
import { useTheme } from "@/theme/theme";
import { Link } from "expo-router";

export default function PortfolioTab() {
  const { colors } = useTheme();
  const data = useAsync(async () => {
    const [dash, holdings, history] = await Promise.all([api.getDashboard(), api.listHoldings(), api.getPortfolioHistory()]);
    return { dash, holdings, history };
  });
  if (data.loading) return <Screen><Loading /></Screen>;
  if (data.error || !data.data) return <Screen><ErrorBox message={data.error ?? "Could not load your portfolio."} onRetry={data.reload} /></Screen>;
  const { dash, holdings, history } = data.data;
  const pnl = dash.investmentValue.unrealisedPnl;
  const up = BigInt(pnl.amountMinor) >= 0n;

  return (
    <Screen>
      <Title eyebrow="Investments" title="My portfolio" description="Investment valuations are separate from your cash balances." />
      <Card>
        <Stat label="Market value" value={formatMoney(dash.investmentValue.marketValue)} sub={dash.investmentValue.source} />
        <Stat label="Unrealised P&L" value={formatMoney(pnl, { sign: true })} sub={`${dash.investmentValue.unrealisedPnlPct >= 0 ? "+" : ""}${dash.investmentValue.unrealisedPnlPct.toFixed(2)}%`} tone={up ? "up" : "down"} />
        <AreaChart values={history.map((p) => p.value)} height={140} tone={up ? "up" : "down"} label="Portfolio value, 30 days, sample data" />
      </Card>
      <Heading>Holdings</Heading>
      {holdings.map((h) => {
        const value = h.quantity * h.lastPrice;
        const gain = value - h.quantity * h.avgCost;
        return (
          <Card key={h.symbol}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <View style={{ flexShrink: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.foreground, fontWeight: "700" }}>{h.name}</Text>
                <Muted>{h.symbol} · {h.quantity} shares · avg {h.avgCost.toFixed(2)} {h.currency}</Muted>
              </View>
              <Badge>{h.market}</Badge>
            </View>
            <Row label="Value" value={`${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${h.currency}`} strong />
            <Row label="Gain / loss" value={`${gain >= 0 ? "+" : "−"}${Math.abs(gain).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} tone={gain >= 0 ? "up" : "down"} />
          </Card>
        );
      })}
      <Muted>Sample holdings. Real holdings come from your brokerage partner. Values are in each holding's own currency.</Muted>
      <Link href="/reports" asChild><Button variant="outline">Statements</Button></Link>
    </Screen>
  );
}
