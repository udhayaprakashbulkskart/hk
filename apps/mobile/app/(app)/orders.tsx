import { useState } from "react";
import { Text, View } from "react-native";
import { api } from "@hkfinhub/api-client";
import type { OrderState } from "@hkfinhub/types";
import { Badge, Card, Chip, Empty, ErrorBox, Loading, Screen, Title } from "@/components/ui";
import { useAsync } from "@/lib/useAsync";
import { useTheme } from "@/theme/theme";

const TABS: [string, string][] = [["open", "Open"], ["completed", "Completed"], ["cancelled", "Cancelled"]];
const TONE: Record<OrderState, "gold" | "success" | "neutral" | "danger"> = { open: "gold", partially_filled: "gold", filled: "success", cancelled: "neutral", rejected: "danger" };
const LABEL: Record<OrderState, string> = { open: "Open", partially_filled: "Partly filled", filled: "Filled", cancelled: "Cancelled", rejected: "Rejected" };

export default function OrdersScreen() {
  const { colors } = useTheme();
  const [tab, setTab] = useState("open");
  const orders = useAsync(() => api.listOrders());
  if (orders.loading) return <Screen><Loading /></Screen>;
  if (orders.error || !orders.data) return <Screen><ErrorBox message={orders.error ?? "Could not load orders."} onRetry={orders.reload} /></Screen>;
  const rows = orders.data.filter((o) =>
    tab === "open" ? o.state === "open" || o.state === "partially_filled" : tab === "completed" ? o.state === "filled" : o.state === "cancelled" || o.state === "rejected");
  return (
    <Screen>
      <Title eyebrow="Investments" title="Orders and trades" description="Every order and its status, from the brokerage partner." />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {TABS.map(([k, l]) => <Chip key={k} label={l} selected={tab === k} onPress={() => setTab(k)} />)}
      </View>
      {rows.length === 0 ? <Empty title="Nothing here yet" body="Orders appear here after you place them. Trading is not yet enabled." /> : rows.map((o) => (
        <Card key={o.id} style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: o.side === "buy" ? colors.success : colors.destructive, fontWeight: "700" }}>{o.side.toUpperCase()} <Text style={{ color: colors.foreground }}>{o.symbol} × {o.quantity}</Text></Text>
            <Badge tone={TONE[o.state]}>{LABEL[o.state]}</Badge>
          </View>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{o.id} · {o.filled}/{o.quantity} filled · {o.limitPrice ? `limit ${o.limitPrice} ${o.currency}` : "market"}</Text>
        </Card>
      ))}
    </Screen>
  );
}
