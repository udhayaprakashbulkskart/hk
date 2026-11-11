import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { palettes, type Palette } from "@hkfinhub/tokens";

export type ThemeChoice = "dark" | "light" | "system";
interface ThemeCtx {
  colors: Palette;
  mode: "dark" | "light";
  choice: ThemeChoice;
  setChoice: (c: ThemeChoice) => void;
}

const KEY = "hkf.theme";
const Ctx = createContext<ThemeCtx | null>(null);

/** Dark is the brand default. The choice is a per-device preference, not a secret. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [choice, setChoiceState] = useState<ThemeChoice>("dark");

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => { if (v === "dark" || v === "light" || v === "system") setChoiceState(v); })
      .catch(() => undefined);
  }, []);

  const setChoice = (c: ThemeChoice) => {
    setChoiceState(c);
    AsyncStorage.setItem(KEY, c).catch(() => undefined);
  };

  const mode: "dark" | "light" = choice === "system" ? (system === "light" ? "light" : "dark") : choice;
  const value = useMemo<ThemeCtx>(() => ({ colors: palettes[mode], mode, choice, setChoice }), [mode, choice]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used inside ThemeProvider");
  return v;
}
