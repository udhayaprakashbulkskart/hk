import { Text, View } from "react-native";
import { api } from "@hkfinhub/api-client";
import { Badge, Card, ErrorBox, Loading, Muted, Row, Screen, Title } from "@/components/ui";
import { useAsync } from "@/lib/useAsync";
import { useTheme } from "@/theme/theme";

const KYC: Record<string, { label: string; tone: "success" | "gold" | "danger" | "neutral" }> = {
  not_started: { label: "Not started", tone: "neutral" }, documents_pending: { label: "Documents needed", tone: "gold" }, under_review: { label: "Under review", tone: "gold" },
  verified: { label: "Verified", tone: "success" }, rejected: { label: "Not approved", tone: "danger" }, additional_info_required: { label: "More information needed", tone: "gold" },
};

export default function ProfileScreen() {
  const { colors } = useTheme();
  const dash = useAsync(() => api.getDashboard());
  if (dash.loading) return <Screen><Loading /></Screen>;
  if (dash.error || !dash.data) return <Screen><ErrorBox message={dash.error ?? "Could not load profile."} onRetry={dash.reload} /></Screen>;
  const k = KYC[dash.data.kyc] ?? KYC.not_started!;
  return (
    <Screen>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: colors.gold, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.gold, fontWeight: "700", fontSize: 20 }}>SC</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Title title="Your profile" />
          <Muted>Customer details appear once your account is verified</Muted>
          <Badge tone={k.tone}>{k.label}</Badge>
        </View>
      </Card>
      <Card>
        <Row label="Country" value="Hong Kong" />
        <Row label="Language" value="English" />
        <Row label="Base currency" value={dash.data.baseCurrency} />
        <Row label="Time zone" value="Asia/Hong_Kong" />
      </Card>
      <Card>
        <Text accessibilityRole="header" style={{ color: colors.foreground, fontWeight: "700" }}>Linked payment accounts</Text>
        {dash.data.accounts.filter((a) => a.kind !== "demat").map((a) => <Row key={a.id} label={a.name} value={a.reference} />)}
      </Card>
    </Screen>
  );
}
