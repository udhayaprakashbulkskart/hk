import { View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useTheme } from "@/theme/theme";

/** Area chart drawn with SVG. Values are display numbers only. */
export function AreaChart({ values, height = 160, tone = "gold", label }: { values: number[]; height?: number; tone?: "gold" | "up" | "down"; label: string }) {
  const { colors } = useTheme();
  const width = 320;
  const stroke = tone === "up" ? colors.success : tone === "down" ? colors.destructive : colors.gold;
  if (values.length < 2) return <View style={{ height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * width,
    y: height - 8 - ((v - min) / span) * (height - 16),
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ height, width: "100%" }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={stroke} stopOpacity="0.35" />
            <Stop offset="1" stopColor={stroke} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#fill)" />
        <Path d={line} stroke={stroke} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
