import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Web preview of the Expo app (same React Native screens, rendered by react-native-web).
 * Real iOS and Android simulators are not available in this environment; their JS bundles are
 * verified by `expo export` instead. Set SCREENSHOT_DIR to save PNGs for review.
 */

const SHOT_DIR = process.env.SCREENSHOT_DIR;
const CUSTOMER_ROUTES = [
  "/home", "/invest", "/send", "/portfolio", "/more", "/accounts", "/receive", "/transfer",
  "/exchange", "/history", "/notifications", "/security", "/profile", "/settings", "/scan",
  "/deposit", "/withdraw", "/reports", "/orders", "/symbol/AAPL", "/pay/REQ-AB12CD",
];
const PUBLIC_ROUTES = ["/login", "/reset"];

/** Client-side navigation keeps the in-memory sandbox session alive across screens. */
async function navigate(page: Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, "", p);
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
  }, path);
}

const API = "http://localhost:4000";
const TOKENS = { accessToken: "a".repeat(40), accessTokenExpiresIn: 900, refreshToken: "r".repeat(40), refreshTokenExpiresIn: 2592000 };

/** Signs in through the real login screen, with the API intercepted at the browser boundary. */
async function signIn(page: Page) {
  await page.route(`${API}/v1/**`, (route) => {
    if (route.request().url().endsWith("/v1/auth/login")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "authenticated", tokens: TOKENS, sessionId: "s", deviceId: "d" }) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "NOT_FOUND", message: "No such endpoint." } }) });
  });
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill("customer@example.com");
  await page.getByLabel("Password").fill("not-a-real-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("link", { name: "View accounts" })).toBeVisible({ timeout: 20_000 });
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => { try { localStorage.setItem("hkf.theme", t); } catch { /* ignore */ } }, theme);
    });

    test("sign-in flow reaches the home tab", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await signIn(page);
      await expect(page).toHaveURL(/\/home$/);
      expect(errors, "no uncaught errors").toEqual([]);
    });

    test("every screen renders without overflow or uncaught errors", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource.*404/.test(m.text())) errors.push(`console: ${m.text()}`); });
      await signIn(page);

      const dir = SHOT_DIR ? join(SHOT_DIR, theme) : null;
      if (dir) mkdirSync(dir, { recursive: true });

      for (const route of CUSTOMER_ROUTES) {
        const before = errors.length;
        await navigate(page, route);
        await page.waitForTimeout(400);
        expect(errors.length, `no uncaught error on ${route}: ${errors.slice(before).join(" | ")}`).toBe(before);
        const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        expect(overflow.sw, `no horizontal scroll on ${route}`).toBeLessThanOrEqual(overflow.cw + 1);
        if (dir) await page.screenshot({ path: join(dir, `${route.replace(/^\//, "").replace(/[/?=]+/g, "_")}.png`), fullPage: true });
      }
      expect(errors, "no uncaught errors across screens").toEqual([]);
    });

    test("public screens render", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      for (const route of PUBLIC_ROUTES) {
        await page.goto(route, { waitUntil: "networkidle" });
        await page.waitForTimeout(300);
        const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        expect(overflow.sw, `no horizontal scroll on ${route}`).toBeLessThanOrEqual(overflow.cw + 1);
        if (SHOT_DIR) {
          const dir = join(SHOT_DIR, theme);
          mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: join(dir, `public-${route.replace(/^\//, "").replace(/[/?=]+/g, "_")}.png`), fullPage: true });
        }
      }
      expect(errors).toEqual([]);
    });
  });
}

test("a payment link opens the request screen", async ({ page }) => {
  await signIn(page);
  await navigate(page, "/pay/REQ-AB12CD");
  await expect(page.getByText("Request REQ-AB12CD")).toBeVisible();
});

test("invalid payment reference is rejected", async ({ page }) => {
  await signIn(page);
  await navigate(page, "/pay/not-valid");
  await expect(page.getByText("This payment link is not valid.")).toBeVisible();
});
