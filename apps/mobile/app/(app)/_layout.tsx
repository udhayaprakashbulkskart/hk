import { Stack } from "expo-router";
import { useTheme } from "@/theme/theme";

export default function AppLayout() {
  const { colors } = useTheme();
  const opts = {
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.foreground,
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.background },
  };
  return (
    <Stack screenOptions={opts}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="accounts" options={{ title: "Accounts" }} />
      <Stack.Screen name="receive" options={{ title: "Receive money" }} />
      <Stack.Screen name="transfer" options={{ title: "Global transfer" }} />
      <Stack.Screen name="exchange" options={{ title: "Currency exchange" }} />
      <Stack.Screen name="history" options={{ title: "Transactions" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
      <Stack.Screen name="security" options={{ title: "Security" }} />
      <Stack.Screen name="profile" options={{ title: "Profile" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      <Stack.Screen name="scan" options={{ title: "Scan QR code", presentation: "modal" }} />
      <Stack.Screen name="deposit" options={{ title: "Deposit" }} />
      <Stack.Screen name="withdraw" options={{ title: "Withdraw" }} />
      <Stack.Screen name="reports" options={{ title: "Statements" }} />
      <Stack.Screen name="orders" options={{ title: "Orders and trades" }} />
    </Stack>
  );
}
