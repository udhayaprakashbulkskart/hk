import { api, formatMoney } from "@hkfinhub/api-client";
import { Badge, Button, Card, ErrorBox, Loading, Muted, Row, Screen, Title } from "@/components/ui";
import { useAsync } from "@/lib/useAsync";
import { useTheme } from "@/theme/theme";
import { Text, View } from "react-native";

export default function AccountsScreen() {
  const { colors } = useTheme();
  const data = useAsync(async () => Promise.all([api.getDashboard(), api.listCurrencyBalances()]));
  if (data.loading) return <Screen><Loading /></Screen>;
  if (data.error || !data.data) return <Screen><ErrorBox message={data.error ?? "Could not load accounts."} onRetry={data.reload} /></Screen>;
  const [dash, balances] = data.data;
  return (
    <Screen>
      <Title eyebrow="Your accounts" title="Accounts" description="Cash is shown per currency. Investments are valued separately." />
      <Card>
        <Row label="Cash balance (HKD)" value={formatMoney(dash.cashTotal)} strong />
        <Row label="Total deposits" value={formatMoney(dash.totals.deposits)} />
        <Row label="Total withdrawals" value={formatMoney(dash.totals.withdrawals)} />
      </Card>
      {dash.accounts.filter((a) => a.kind !== "demat").map((a) => (
        <Card key={a.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16 }}>{a.name}</Text>
            <Badge>{a.reference}</Badge>
          </View>
          <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{formatMoney(a.balance)}</Text>
        </Card>
      ))}
      <Card style={{ gap: 0 }}>
        <Text accessibilityRole="header" style={{ color: colors.foreground, fontWeight: "700", marginBottom: 8 }}>Currency balances</Text>
        {balances.map((b) => (
          <View key={b.currency} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderTopWidth: 0.5, borderColor: colors.border }}>
            <Text style={{ color: colors.foreground, fontWeight: "600" }}>{b.currency}</Text>
            {BigInt(b.total.amountMinor) > 0n ? (
              <Text style={{ color: colors.foreground, fontVariant: ["tabular-nums"] }}>{formatMoney(b.total)}</Text>
            ) : (
              <Button variant="outline" disabled>Open</Button>
            )}
          </View>
        ))}
        <Muted>Opening a currency account needs completed account verification.</Muted>
      </Card>
    </Screen>
  );
}
