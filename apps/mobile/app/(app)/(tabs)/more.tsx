import { Link, router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Muted, Screen, Title } from "@/components/ui";
import { useSession } from "@/lib/session";
import { resetUnlock } from "@/lib/prefs";
import { useTheme } from "@/theme/theme";

const ITEMS: [string, keyof typeof Ionicons.glyphMap, string][] = [
  ["Scan QR code", "qr-code-outline", "/scan"],
  ["Accounts", "wallet-outline", "/accounts"],
  ["Receive money", "download-outline", "/receive"],
  ["Global transfer", "globe-outline", "/transfer"],
  ["Currency exchange", "swap-horizontal-outline", "/exchange"],
  ["Deposit", "arrow-down-circle-outline", "/deposit"],
  ["Withdraw", "arrow-up-circle-outline", "/withdraw"],
  ["Transactions", "receipt-outline", "/history"],
  ["Statements", "document-text-outline", "/reports"],
  ["Notifications", "notifications-outline", "/notifications"],
  ["Security", "shield-checkmark-outline", "/security"],
  ["Profile", "person-outline", "/profile"],
  ["Settings", "settings-outline", "/settings"],
];

export default function MoreTab() {
  const { colors } = useTheme();
  const { signOut } = useSession();
  async function onSignOut() {
    resetUnlock();
    await signOut();
    router.replace("/(auth)/login");
  }
  return (
    <Screen>
      <Title title="More" description="Everything else in HK FinHub." />
      <Card style={{ padding: 0, gap: 0, overflow: "hidden" }}>
        {ITEMS.map(([label, icon, href], i) => (
          <Link key={href} href={href as never} asChild>
            <Pressable accessibilityRole="link" accessibilityLabel={label} style={({ pressed }) => ({ minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderTopWidth: i === 0 ? 0 : 0.5, borderColor: colors.border, backgroundColor: pressed ? colors.secondary : "transparent" })}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Ionicons name={icon} size={20} color={colors.gold} />
                <Text style={{ color: colors.foreground, fontSize: 16 }}>{label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </Pressable>
          </Link>
        ))}
      </Card>
      <Button variant="outline" onPress={onSignOut}>Sign out</Button>
    </Screen>
  );
}
