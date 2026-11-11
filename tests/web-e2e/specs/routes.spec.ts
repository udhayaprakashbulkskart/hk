import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Layout and smoke checks for every screen at phone, tablet and desktop widths in both themes.
 * Set SCREENSHOT_DIR to save PNGs for review.
 */

const ROUTES = [
  "/", "/login", "/reset-password",
  "/dashboard", "/accounts", "/send", "/receive", "/transfer", "/exchange", "/invest",
  "/invest/orders?tab=open", "/portfolio", "/history", "/reports", "/notifications", "/security",
  "/profile", "/settings", "/more", "/deposit", "/withdraw",
];

const VIEWPORTS = [
  { name: "phone-360", width: 360, height: 800 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1440", width: 1440, height: 900 },
] as const;

const THEMES = ["dark", "light"] as const;
const SHOT_DIR = process.env.SCREENSHOT_DIR;

function safeName(route: string) {
  return route.replace(/^\//, "").replace(/[?=&/]+/g, "_") || "home";
}

for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    test.describe(`${vp.name} · ${theme}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test.beforeEach(async ({ page }) => {
        await page.addInitScript((t) => {
          try { localStorage.setItem("hkf-theme", t); } catch { /* ignore */ }
        }, theme);
      });

      for (const route of ROUTES) {
        test(`${route} renders without horizontal overflow`, async ({ page }) => {
          const errors: string[] = [];
          page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
          page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
          page.on("response", (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });

          const response = await page.goto(route, { waitUntil: "networkidle" });
          expect(response?.status(), `HTTP status for ${route}`).toBe(200);

          // One level-one heading per screen, for screen readers.
          await expect(page.locator("h1").first()).toBeVisible();
          expect(await page.locator("h1").count(), "exactly one h1").toBe(1);

          // The theme applied before paint.
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

          const overflow = await page.evaluate(() => ({
            scroll: document.documentElement.scrollWidth,
            client: document.documentElement.clientWidth,
          }));
          expect(overflow.scroll, `no horizontal page scroll at ${vp.width}px`).toBeLessThanOrEqual(overflow.client + 1);

          // Sample-data notice is always visible on the customer app.
          if (route.startsWith("/dashboard") || route === "/send") {
            await expect(page.getByRole("note").first()).toBeVisible();
          }

          expect(errors, "no console or page errors").toEqual([]);

          if (SHOT_DIR) {
            const dir = join(SHOT_DIR, `${vp.name}-${theme}`);
            mkdirSync(dir, { recursive: true });
            await page.screenshot({ path: join(dir, `${safeName(route)}.png`), fullPage: true });
          }
        });
      }
    });
  }
}

test("skip link and keyboard focus are reachable on the dashboard", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
});
