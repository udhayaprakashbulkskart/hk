import { useMemo, useState } from "react";
import { Link } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import { api } from "@hkfinhub/api-client";
import type { MarketQuote } from "@hkfinhub/types";
import { Chip, Card, ErrorBox, Loading, Muted, Screen, Notice, Title, Button } from "@/components/ui";
import { useAsync } from "@/lib/useAsync";
import { useTheme } from "@/theme/theme";

const MARKETS: [string, string][] = [["ALL", "All"], ["HK", "Hong Kong"], ["US", "United States"], ["IN", "India"]];

export default function InvestTab() {
  const { colors } = useTheme();
  const market = useAsync(() => api.listMarket());
  const [filter, setFilter] = useState("ALL");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (market.data ?? []).filter((m) => (filter === "ALL" || m.market === filter) && (!term || m.symbol.toLowerCase().includes(term) || m.name.toLowerCase().includes(term)));
  }, [market.data, filter, q]);

  if (market.loading) return <Screen><Loading /></Screen>;
  if (market.error) return <Screen><ErrorBox message={market.error} onRetry={market.reload} /></Screen>;

  return (
    <Screen>
      <Title eyebrow="Investments" title="Markets" description="Hong Kong, United States and India markets. Market data appears once it is licensed and connected." />
      <Notice>Market data is not connected yet. Trading is not yet enabled.</Notice>
      <TextInput
        accessibilityLabel="Search stocks, funds or symbols"
        placeholder="Search stocks, funds or symbols"
        placeholderTextColor={colors.mutedForeground}
        value={q}
        onChangeText={setQ}
        autoCapitalize="characters"
        style={{ minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary, color: colors.foreground, paddingHorizontal: 12, fontSize: 16 }}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {MARKETS.map(([key, label]) => (
          <Chip key={key} label={label} selected={filter === key} onPress={() => setFilter(key)} />
        ))}
      </View>
      {rows.length === 0 ? <Muted>No matches. Try another symbol or market.</Muted> : null}
      <Card style={{ padding: 0, gap: 0, overflow: "hidden" }}>
        {rows.map((m: MarketQuote, i) => (
          <Link key={m.symbol} href={{ pathname: "/symbol/[symbol]", params: { symbol: m.symbol } }} asChild>
            <Pressable accessibilityRole="link" accessibilityLabel={`${m.name}, ${m.price}, ${m.changePct}%`} style={({ pressed }) => ({ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, gap: 12, borderTopWidth: i === 0 ? 0 : 0.5, borderColor: colors.border, backgroundColor: pressed ? colors.secondary : "transparent" })}>
              <View style={{ flexShrink: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.foreground, fontWeight: "600" }}>{m.name}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{m.symbol} · {m.market}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: colors.foreground, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{m.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}</Text>
                <Text style={{ color: m.changePct >= 0 ? colors.success : colors.destructive, fontSize: 12, fontVariant: ["tabular-nums"] }}>{m.changePct >= 0 ? "+" : ""}{m.changePct.toFixed(2)}%</Text>
              </View>
            </Pressable>
          </Link>
        ))}
      </Card>
      <Link href="/orders" asChild><Button variant="outline">My orders and trades</Button></Link>
    </Screen>
  );
}
