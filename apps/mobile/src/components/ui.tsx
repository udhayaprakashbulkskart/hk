import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle, type StyleProp } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";

export function Screen({ children, scroll = true, padded = true }: { children: ReactNode; scroll?: boolean; padded?: boolean }) {
  const { colors } = useTheme();
  const body = <View style={[padded && styles.pad, { gap: 16 }]}>{children}</View>;
  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">{body}</ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

export function Title({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      {eyebrow ? <Text style={[styles.eyebrow, { color: colors.gold }]}>{eyebrow.toUpperCase()}</Text> : null}
      <Text accessibilityRole="header" style={[styles.h1, { color: colors.foreground }]}>{title}</Text>
      {description ? <Text style={[styles.body, { color: colors.mutedForeground }]}>{description}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>{children}</View>;
}

export function Heading({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <Text accessibilityRole="header" style={[styles.h2, { color: colors.foreground }]}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.small, { color: colors.mutedForeground }]}>{children}</Text>;
}

export function Button({
  children, onPress, variant = "primary", disabled, loading, accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  variant?: "primary" | "outline" | "gold" | "danger";
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const map = {
    primary: { bg: colors.primary, fg: colors.primaryForeground, border: colors.primary },
    outline: { bg: "transparent", fg: colors.foreground, border: colors.border },
    gold: { bg: "transparent", fg: colors.gold, border: colors.gold },
    danger: { bg: colors.destructive, fg: "#ffffff", border: colors.destructive },
  }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: map.bg, borderColor: map.border, opacity: off ? 0.5 : pressed ? 0.85 : 1 }]}
    >
      {loading ? <ActivityIndicator color={map.fg} /> : <Text style={[styles.buttonText, { color: map.fg }]}>{children}</Text>}
    </Pressable>
  );
}

export function Field({ label, hint, error, ...input }: { label: string; hint?: string; error?: string | null } & TextInputProps) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.mutedForeground}
        {...input}
        style={[styles.input, { backgroundColor: colors.secondary, borderColor: error ? colors.destructive : colors.border, color: colors.foreground }]}
      />
      {error ? <Text accessibilityRole="alert" style={[styles.small, { color: colors.destructive }]}>{error}</Text> : hint ? <Muted>{hint}</Muted> : null}
    </View>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "gold" | "danger" | "primary" }) {
  const { colors } = useTheme();
  const map = {
    neutral: { bg: colors.secondary, fg: colors.mutedForeground },
    success: { bg: "rgba(21,155,112,0.15)", fg: colors.success },
    gold: { bg: "rgba(198,163,74,0.12)", fg: colors.gold },
    danger: { bg: "rgba(224,68,68,0.15)", fg: colors.destructive },
    primary: { bg: "rgba(181,18,27,0.15)", fg: colors.primary },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]}>
      <Text style={[styles.badgeText, { color: map.fg }]}>{children}</Text>
    </View>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
  const { colors } = useTheme();
  const subColor = tone === "up" ? colors.success : tone === "down" ? colors.destructive : colors.mutedForeground;
  return (
    <View style={{ gap: 2 }}>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      {sub ? <Text style={[styles.small, { color: subColor }]}>{sub}</Text> : null}
    </View>
  );
}

export function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "up" | "down" }) {
  const { colors } = useTheme();
  const vc = tone === "up" ? colors.success : tone === "down" ? colors.destructive : colors.foreground;
  return (
    <View style={styles.row}>
      <Text style={[styles.small, { color: colors.mutedForeground, flexShrink: 1 }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: vc, fontWeight: strong ? "700" : "500" }]}>{value}</Text>
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : "transparent" }]}
    >
      <Text style={{ color: selected ? colors.primaryForeground : colors.mutedForeground, fontWeight: "600", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function SandboxNotice({ children }: { children?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="none" style={[styles.notice, { borderColor: colors.gold, backgroundColor: "rgba(198,163,74,0.1)" }]}>
      <Text style={[styles.small, { color: colors.foreground }]}>
        {children ?? "Sandbox preview. Figures are sample data. Live payments and trading are not yet enabled."}
      </Text>
    </View>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.empty, { borderColor: colors.border }]}>
      <Text style={{ color: colors.foreground, fontWeight: "600" }}>{title}</Text>
      <Muted>{body}</Muted>
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <Card>
      <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{message}</Text>
      {onRetry ? <View style={{ marginTop: 12 }}><Button variant="outline" onPress={onRetry}>Try again</Button></View> : null}
    </Card>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return <View style={{ padding: 32, alignItems: "center" }}><ActivityIndicator color={colors.gold} /></View>;
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingTop: 12 },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1.6 },
  h1: { fontSize: 26, fontWeight: "700", letterSpacing: -0.4 },
  h2: { fontSize: 17, fontWeight: "700" },
  body: { fontSize: 14, lineHeight: 20 },
  small: { fontSize: 13, lineHeight: 18 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  button: { minHeight: 48, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  buttonText: { fontSize: 16, fontWeight: "700" },
  label: { fontSize: 14, fontWeight: "600" },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontSize: 16 },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  statLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1 },
  statValue: { fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  rowValue: { fontSize: 13, textAlign: "right", flexShrink: 1, fontVariant: ["tabular-nums"] },
  chip: { minHeight: 36, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, justifyContent: "center" },
  notice: { borderRadius: 12, borderWidth: 1, padding: 12 },
  empty: { borderRadius: 16, borderWidth: 1, borderStyle: "dashed", padding: 24, gap: 6, alignItems: "center" },
});
