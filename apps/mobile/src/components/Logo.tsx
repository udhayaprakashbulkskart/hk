import { Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { useTheme } from "@/theme/theme";

/** HK FinHub mark: an original red tile with a gold harbour line. Not a bank or government emblem. */
export function Logo({ size = 32, wordmark = true }: { size?: number; wordmark?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }} accessibilityLabel="HK FinHub">
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Rect width="32" height="32" rx="8" fill={colors.primary} />
        <Path d="M6 20 Q 16 10 26 20" fill="none" stroke={colors.gold} strokeWidth="2.2" strokeLinecap="round" />
        <Path d="M9 24.5 H23" stroke={colors.gold} strokeWidth="1.8" strokeLinecap="round" opacity={0.7} />
      </Svg>
      {wordmark ? (
        <Text style={{ fontSize: size * 0.5, fontWeight: "700", color: colors.foreground }}>
          HK <Text style={{ color: colors.gold }}>FinHub</Text>
        </Text>
      ) : null}
    </View>
  );
}
