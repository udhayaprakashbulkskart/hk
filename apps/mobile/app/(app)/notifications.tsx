import { Text } from "react-native";
import { api } from "@hkfinhub/api-client";
import { Badge, Card, ErrorBox, Loading, Screen, Title } from "@/components/ui";
import { useAsync } from "@/lib/useAsync";
import { useTheme } from "@/theme/theme";

const CAT: Record<string, { label: string; tone: "danger" | "success" | "gold" | "primary" | "neutral" }> = {
  security: { label: "Security", tone: "danger" }, payment: { label: "Payment", tone: "success" }, transfer: { label: "Transfer", tone: "gold" },
  kyc: { label: "Verification", tone: "primary" }, trade: { label: "Trading", tone: "gold" }, system: { label: "System", tone: "neutral" },
};

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const items = useAsync(() => api.listNotifications());
  if (items.loading) return <Screen><Loading /></Screen>;
  if (items.error || !items.data) return <Screen><ErrorBox message={items.error ?? "Could not load notifications."} onRetry={items.reload} /></Screen>;
  return (
    <Screen>
      <Title title="Notifications" description="Security alerts are always sent, whatever your preferences." />
      {items.data.map((n) => (
        <Card key={n.id} style={{ borderLeftWidth: n.read ? 1 : 4, borderLeftColor: colors.primary }}>
          <Badge tone={CAT[n.category]?.tone ?? "neutral"}>{CAT[n.category]?.label ?? n.category}</Badge>
          <Text style={{ color: colors.foreground, fontWeight: "700" }}>{n.title}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>{n.body}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{new Date(n.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Hong_Kong", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} HKT{n.read ? "" : " · New"}</Text>
        </Card>
      ))}
    </Screen>
  );
}
