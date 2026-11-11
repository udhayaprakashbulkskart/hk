import { useState } from "react";
import { Switch, Text, View } from "react-native";
import { Card, Chip, Heading, Muted, Screen, Title } from "@/components/ui";
import { useTheme, type ThemeChoice } from "@/theme/theme";

const PREFS = [
  ["Payments received and transfers", true],
  ["Trade execution", true],
  ["Verification updates", true],
  ["Product news", false],
] as const;

export default function SettingsScreen() {
  const { colors, choice, setChoice } = useTheme();
  const [on, setOn] = useState<boolean[]>(PREFS.map(([, v]) => v));
  const themes: [ThemeChoice, string][] = [["dark", "Dark (default)"], ["light", "Light"], ["system", "System"]];
  return (
    <Screen>
      <Title title="Settings" description="Appearance and notifications. Saved on this device." />
      <Heading>Appearance</Heading>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {themes.map(([v, l]) => <Chip key={v} label={l} selected={choice === v} onPress={() => setChoice(v)} />)}
      </View>
      <Heading>Notifications</Heading>
      <Card style={{ gap: 0 }}>
        {PREFS.map(([label], i) => (
          <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderTopWidth: i ? 0.5 : 0, borderColor: colors.border, gap: 12 }}>
            <Text style={{ color: colors.foreground, flexShrink: 1 }}>{label}</Text>
            <Switch value={on[i]} onValueChange={(v) => setOn(on.map((x, j) => (j === i ? v : x)))} accessibilityLabel={label} />
          </View>
        ))}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderTopWidth: 0.5, borderColor: colors.border }}>
          <Text style={{ color: colors.foreground }}>Security alerts (always on)</Text>
          <Switch value disabled accessibilityLabel="Security alerts, always on" />
        </View>
      </Card>
      <Muted>Preferences are saved to your account once live sign-in is connected.</Muted>
    </Screen>
  );
}
