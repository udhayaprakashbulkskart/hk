import { Stack } from "expo-router";
import { useTheme } from "@/theme/theme";

export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="login" options={{ title: "Log in", headerLeft: () => null }} />
      <Stack.Screen name="register" options={{ title: "Create account" }} />
      <Stack.Screen name="otp" options={{ title: "Verify" }} />
      <Stack.Screen name="reset" options={{ title: "Reset password" }} />
      <Stack.Screen name="mfa" options={{ title: "Two-step verification", headerLeft: () => null }} />
    </Stack>
  );
}
