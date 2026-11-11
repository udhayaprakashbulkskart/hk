import { useState } from "react";
import { Text, View } from "react-native";
import { api, formatMoney } from "@hkfinhub/api-client";
import type { Transaction } from "@hkfinhub/types";
import { Badge, Card, Chip, ErrorBox, Loading, Muted, Screen, Title } from "@/components/ui";
import { useAsync } from "@/lib/useAsync";
import { useTheme } from "@/theme/theme";

const FILTERS: [string, string][] = [["all", "All"], ["in", "Money in"], ["out", "Money out"], ["trades", "Trades"], ["pending", "Pending"]];
const STATUS: Record<Transaction["status"], { tone: "success" | "gold" | "danger" | "neutral"; label: string }> = {
  posted: { tone: "success", label: "Completed" }, pending: { tone: "gold", label: "Pending" }, failed: { tone: "danger", label: "Failed" }, reversed: { tone: "neutral", label: "Reversed" },
};

function matches(t: Transaction, f: string) {
  const n = BigInt(t.signedAmountMinor);
  if (f === "in") return n > 0n;
  if (f === "out") return n < 0n && t.kind !== "trade";
  if (f === "trades") return t.kind === "trade";
  if (f === "pending") return t.status === "pending";
  return true;
}

export default function HistoryScreen() {
  const { colors } = useTheme();
  const [filter, setFilter] = useState("all");
  const txns = useAsync(() => api.listTransactions());
  if (txns.loading) return <Screen><Loading /></Screen>;
  if (txns.error || !txns.data) return <Screen><ErrorBox message={txns.error ?? "Could not load transactions."} onRetry={txns.reload} /></Screen>;
  const rows = txns.data.filter((t) => matches(t, filter));
  return (
    <Screen>
      <Title eyebrow="Activity" title="Transactions" description="Pending items update once our payment partner confirms them." />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {FILTERS.map(([k, l]) => <Chip key={k} label={l} selected={filter === k} onPress={() => setFilter(k)} />)}
      </View>
      {rows.length === 0 ? <Muted>No transactions match this filter.</Muted> : null}
      {rows.map((t) => {
        const s = STATUS[t.status];
        const n = BigInt(t.signedAmountMinor);
        return (
          <Card key={t.id} style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
              <Text numberOfLines={2} style={{ color: colors.foreground, fontWeight: "600", flexShrink: 1 }}>{t.title}</Text>
              <Text style={{ color: n > 0n ? colors.success : colors.foreground, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{formatMoney({ amountMinor: n.toString(), currency: t.amount.currency }, { sign: true })}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Muted>{t.reference}</Muted>
              <Badge tone={s.tone}>{s.label}</Badge>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
