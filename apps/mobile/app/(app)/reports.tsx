import { Text, View } from "react-native";
import { Badge, Card, Screen, Title, Muted } from "@/components/ui";
import { useTheme } from "@/theme/theme";

const STATEMENTS = [
  { period: "October 2026", kind: "Account statement" },
  { period: "September 2026", kind: "Account statement" },
  { period: "Q3 2026", kind: "Investment statement" },
  { period: "2025 annual", kind: "Tax summary" },
];

export default function ReportsScreen() {
  const { colors } = useTheme();
  return (
    <Screen>
      <Title eyebrow="Documents" title="Statements" description="Downloads are issued for your verified account." />
      {STATEMENTS.map((s) => (
        <Card key={s.period + s.kind} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ color: colors.foreground, fontWeight: "600" }}>{s.kind}</Text>
            <Muted>{s.period}</Muted>
          </View>
          <Badge>Not yet issued</Badge>
        </Card>
      ))}
      <Muted>No statements are available yet.</Muted>
    </Screen>
  );
}
