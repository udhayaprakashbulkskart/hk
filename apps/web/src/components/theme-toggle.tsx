"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@hkfinhub/ui";

type Theme = "light" | "dark";

/** Toggles data-theme on <html>. The choice is a per-viewer convenience stored in localStorage. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("hkf-theme", next);
    } catch {
      /* storage unavailable (private mode): the theme still applies for this page view */
    }
  }

  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={label} title={label}>
      {theme === "dark" ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
    </Button>
  );
}
