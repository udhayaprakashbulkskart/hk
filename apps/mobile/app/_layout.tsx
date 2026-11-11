import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "@/theme/theme";
import { SessionProvider } from "@/lib/session";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <RootStack />
      </SessionProvider>
    </ThemeProvider>
  );
}

function RootStack() {
  const { colors, mode } = useTheme();
  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen name="symbol/[symbol]" options={{ title: "Market" }} />
        <Stack.Screen name="pay/[ref]" options={{ title: "Payment request" }} />
      </Stack>
    </>
  );
}
