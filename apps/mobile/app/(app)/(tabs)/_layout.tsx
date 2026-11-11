import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/theme";

const ICON: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  home: ["home", "home-outline"],
  invest: ["trending-up", "trending-up-outline"],
  send: ["paper-plane", "paper-plane-outline"],
  portfolio: ["pie-chart", "pie-chart-outline"],
  more: ["ellipsis-horizontal-circle", "ellipsis-horizontal-circle-outline"],
};

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarIcon: ({ focused, size }) => {
          const pair = ICON[route.name] ?? ["ellipse", "ellipse-outline"];
          return <Ionicons name={focused ? pair[0] : pair[1]} size={size} color={focused ? colors.primary : colors.mutedForeground} />;
        },
      })}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="invest" options={{ title: "Markets" }} />
      <Tabs.Screen name="send" options={{ title: "Transfer" }} />
      <Tabs.Screen name="portfolio" options={{ title: "Portfolio" }} />
      <Tabs.Screen name="more" options={{ title: "More" }} />
    </Tabs>
  );
}
