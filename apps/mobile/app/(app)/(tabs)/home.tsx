import { Link, router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, formatMoney } from "@hkfinhub/api-client";
import type { Transaction } from "@hkfinhub/types";
import { AreaChart } from "@/components/chart";
import { Badge, Button, Card, ErrorBox, Heading, Loading, Muted, Row, SandboxNotice, Screen, Stat } from "@/components/ui";
import { useAsync } from "@/lib/useAsync";
import { useTheme } from "@/theme/theme";

const QUICK: [string, keyof typeof Ionicons.glyphMap, string][] = [
  ["Send", "paper-plane-outline", "/send"],
  ["Receive", "download-outline", "/receive"],
  ["Deposit", "arrow-down-circle-outline", "/deposit"],
  ["Withdraw", "arrow-up-circle-outline", "/withdraw"],
  ["Global", "globe-outline", "/transfer"],
  ["Exchange", "swap-horizontal-outline", "/exchange"],
  ["Invest", "trending-up-outline", "/invest"],
  ["Portfolio", "pie-chart-outline", "/portfolio"],
];

const STATUS: Record<Transaction["status"], { tone: "success" | "gold" | "danger" | "neutral"; label: string }> = {
  posted: { tone: "success", label: "Completed" },
  pending: { tone: "gold", label: "Pending" },
  failed: { tone: "danger", label: "Failed" },
  reversed: { tone: "neutral", label: "Reversed" },
};

export default function HomeScreen() {
  const { colors } = useTheme();
  const dash = useAsync(async () => {
    const [summary, txns, market, history, notes] = await Promise.all([
      api.getDashboard(), api.listTransactions(), api.listMarket(), api.getPortfolioHistory(), api.listNotifications(),
    ]);
    return { summary, txns, market, history, unread: notes.filter((n) => !n.read).length };
  });

  if (dash.loading) return <Screen><Loading /></Screen>;
  if (dash.error || !dash.data) return <Screen><ErrorBox message={dash.error ?? "Could not load your dashboard."} onRetry={dash.reload} /></Screen>;
  const { summary, txns, market, history, unread } = dash.data;
  const pnl = summary.investmentValue.unrealisedPnl;
  const up = BigInt(pnl.amountMinor) >= 0n;

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: colors.gold, fontSize: 11, fontWeight: "700", letterSpacing: 1.4 }}>YOUR GLOBAL WEALTH HUB</Text>
        <Link href="/notifications" asChild>
          <Pressable accessibilityRole="button" accessibilityLabel={unread ? `Notifications, ${unread} unread` : "Notifications"} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="notifications-outline" size={24} color={colors.foreground} />
            {unread ? <View style={{ position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} /> : null}
          </Pressable>
        </Link>
      </View>

      <SandboxNotice />

      <Card style={{ backgroundColor: colors.card }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Stat label="Total cash balance" value={formatMoney(summary.cashTotal)} sub="Cash only. Excludes investments." />
          <Badge tone="gold">Sample data</Badge>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}><Button onPress={() => router.push("/deposit")} variant="primary">Deposit</Button></View>
          <View style={{ flex: 1 }}><Button onPress={() => router.push("/send")} variant="outline">Transfer</Button></View>
          <View style={{ flex: 1 }}><Button onPress={() => router.push("/withdraw")} variant="outline">Withdraw</Button></View>
        </View>
      </Card>

      <Card>
        <Stat label="Investment value" value={formatMoney(summary.investmentValue.marketValue)} />
        <Stat label="Unrealised P&L" value={formatMoney(pnl, { sign: true })} sub={`${summary.investmentValue.unrealisedPnlPct >= 0 ? "+" : ""}${summary.investmentValue.unrealisedPnlPct.toFixed(2)}% · ${summary.investmentValue.source}`} tone={up ? "up" : "down"} />
        <AreaChart values={history.slice(-14).map((p) => p.value)} height={90} tone={up ? "up" : "down"} label="Portfolio value, last 14 days, sample data" />
      </Card>

      <Heading>Quick actions</Heading>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {QUICK.map(([label, icon, href]) => (
          <Link key={label} href={href as never} asChild>
            <Pressable accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ width: "23.5%", minHeight: 76, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 10, justifyContent: "space-between", opacity: pressed ? 0.8 : 1 })}>
              <Ionicons name={icon} size={22} color={colors.gold} />
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600" }}>{label}</Text>
            </Pressable>
          </Link>
        ))}
      </View>

      <Card>
        <Heading>Accounts</Heading>
        {summary.accounts.map((a) => (
          <View key={a.id} style={{ gap: 2 }}>
            <Row label={a.name} value={formatMoney(a.balance)} strong />
            <Muted>{a.reference}{a.kind === "demat" ? " · investment, not cash" : ""}</Muted>
          </View>
        ))}
        <Link href="/accounts" asChild><Text accessibilityRole="link" style={{ color: colors.gold, fontWeight: "600" }}>View accounts</Text></Link>
      </Card>

      <Card>
        <Heading>Recent transactions</Heading>
        {txns.slice(0, 4).map((t) => {
          const s = STATUS[t.status];
          const n = BigInt(t.signedAmountMinor);
          return (
            <View key={t.id} style={{ gap: 4, borderTopWidth: 0.5, borderColor: colors.border, paddingTop: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <Text numberOfLines={1} style={{ color: colors.foreground, fontWeight: "600", flexShrink: 1 }}>{t.title}</Text>
                <Text style={{ color: n > 0n ? colors.success : colors.foreground, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{formatMoney({ amountMinor: n.toString(), currency: t.amount.currency }, { sign: true })}</Text>
              </View>
              <Badge tone={s.tone}>{s.label}</Badge>
            </View>
          );
        })}
        <Link href="/history" asChild><Text accessibilityRole="link" style={{ color: colors.gold, fontWeight: "600" }}>View all transactions</Text></Link>
      </Card>

      <Card>
        <Heading>Market overview</Heading>
        {market.slice(0, 4).map((q) => (
          <Row key={q.symbol} label={`${q.symbol}`} value={`${q.price.toLocaleString("en-US", { minimumFractionDigits: 2 })} · ${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%`} tone={q.changePct >= 0 ? "up" : "down"} />
        ))}
        <Muted>Sample quotes, delayed. Market data is not yet licensed for live display.</Muted>
      </Card>
    </Screen>
  );
}
