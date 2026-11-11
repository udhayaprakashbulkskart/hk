/**
 * HK FinHub colour tokens for native (React Native) clients.
 * Must match packages/ui/src/tokens.css. Values come from the brand spec.
 */
export interface Palette {
  background: string;
  card: string;
  secondary: string;
  foreground: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  gold: string;
  goldForeground: string;
  success: string;
  destructive: string;
  border: string;
  skyline: string;
}

export const palettes: Record<"dark" | "light", Palette> = {
  dark: {
    background: "#080b10",
    card: "#141821",
    secondary: "#202631",
    foreground: "#f5f5f5",
    mutedForeground: "#a8adb8",
    primary: "#b5121b",
    primaryForeground: "#fff7f7",
    gold: "#c6a34a",
    goldForeground: "#1a1405",
    success: "#159b70",
    destructive: "#e04444",
    border: "rgba(255,255,255,0.09)",
    skyline: "#1b212d",
  },
  light: {
    background: "#f6f4ef",
    card: "#ffffff",
    secondary: "#efece5",
    foreground: "#11141a",
    mutedForeground: "#5a6070",
    primary: "#b5121b",
    primaryForeground: "#fff7f7",
    gold: "#8a6a22",
    goldForeground: "#ffffff",
    success: "#0e7a57",
    destructive: "#c42b2b",
    border: "rgba(17,20,26,0.1)",
    skyline: "#d9d4c7",
  },
};
