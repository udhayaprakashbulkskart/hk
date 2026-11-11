import { test, expect } from "@playwright/test";

const API = "http://localhost:4000";
const TOKENS = { accessToken: "a".repeat(40), accessTokenExpiresIn: 900, refreshToken: "r".repeat(40), refreshTokenExpiresIn: 2592000 };

/** Intercepts the customer API at the browser boundary. The API itself is covered by apps/api tests. */
async function mockApi(page: import("@playwright/test").Page, routes: Record<string, (body: unknown) => { status: number; body: unknown }>) {
  await page.route(`${API}/v1/**`, async (route) => {
    const url = new URL(route.request().url());
    const handler = routes[url.pathname];
    const body = route.request().postDataJSON() as unknown;
    if (!handler) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "NOT_FOUND", message: "No such endpoint." } }) });
    const out = handler(body);
    return route.fulfill({ status: out.status, contentType: "application/json", body: JSON.stringify(out.body) });
  });
}

test.describe("authentication screens", () => {
  test("login asks for both fields, then signs in through the API", async ({ page }) => {
    let sent: unknown = null;
    await mockApi(page, { "/v1/auth/login": (b) => { sent = b; return { status: 200, body: { status: "authenticated", tokens: TOKENS, sessionId: "s", deviceId: "d" } }; } });
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("Enter your email and password.");
    await page.getByLabel("Email").fill("customer@example.com");
    await page.getByLabel("Password").fill("not-a-real-password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    expect(sent).toMatchObject({ email: "customer@example.com", device: { platform: "web" } });
  });

  test("login shows a rate-limit message from the API", async ({ page }) => {
    await mockApi(page, { "/v1/auth/login": () => ({ status: 429, body: { error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later.", retryAfterSeconds: 600 } } }) });
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.getByLabel("Email").fill("customer@example.com");
    await page.getByLabel("Password").fill("whatever-password-1");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("Try again in 10 minute(s).");
  });

  test("login continues to the second step when two-factor is on", async ({ page }) => {
    await mockApi(page, {
      "/v1/auth/login": () => ({ status: 200, body: { status: "mfa_required", mfaToken: "m".repeat(40), mfaTokenExpiresIn: 300 } }),
      "/v1/auth/login/mfa": () => ({ status: 200, body: { status: "authenticated", tokens: TOKENS, sessionId: "s", deviceId: "d" } }),
    });
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.getByLabel("Email").fill("customer@example.com");
    await page.getByLabel("Password").fill("whatever-password-1");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("heading", { name: "Two-step verification" })).toBeVisible();
    await page.getByLabel("Authenticator code").fill("123456");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("password reset answers the same way and moves to the code step", async ({ page }) => {
    await mockApi(page, { "/v1/auth/password/reset/request": () => ({ status: 202, body: { accepted: true } }) });
    await page.goto("/reset-password", { waitUntil: "networkidle" });
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByRole("button", { name: "Send reset code" }).click();
    await expect(page.getByLabel("Code from email")).toBeVisible();
    await expect(page.getByText("If an account exists for that address")).toBeVisible();
  });
});

test.describe("money screens", () => {
  test("send money reaches a pending result and never shows completion", async ({ page }) => {
    await page.goto("/send", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Continue" }).click(); // recipient: first saved recipient is valid
    await page.getByLabel("You send (HKD)").fill("1000");
    await expect(page.getByText("Recipient gets")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Authenticator code").fill("123456");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Submit transfer" }).click();
    await expect(page.getByText("No money has moved")).toBeVisible();
    await expect(page.getByText("Completed")).toHaveCount(0);
  });

  test("send money rejects a zero amount", async ({ page }) => {
    await page.goto("/send", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("You send (HKD)").fill("0");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("greater than zero");
  });

  test("receive generates a QR code image and a payment link", async ({ page }) => {
    await page.goto("/receive", { waitUntil: "networkidle" });
    await expect(page.getByAltText(/QR code for payment request/)).toBeVisible();
    await page.getByLabel("Amount (optional)").fill("250.5");
    await expect(page.getByText("HKD 250.50").first()).toBeVisible();
  });

  test("currency converter shows provider, rate and fee for a valid pair", async ({ page }) => {
    await page.goto("/exchange", { waitUntil: "networkidle" });
    await expect(page.getByText("Service fee")).toBeVisible();
    await expect(page.getByText("Rate provider")).toBeVisible();
    await page.getByLabel("Amount", { exact: true }).fill("0");
    await expect(page.getByText("Enter an amount to see")).toBeVisible();
  });

  test("deposit and withdraw say live movement is not enabled", async ({ page }) => {
    for (const path of ["/deposit", "/withdraw"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      await expect(page.getByText(/not yet enabled/).first()).toBeVisible();
    }
  });

  test("trade ticket cannot place an order in the sandbox", async ({ page }) => {
    await page.goto("/invest", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: /Place (buy|sell) order/ })).toBeDisabled();
  });
});

test.describe("theme and navigation", () => {
  test("theme toggle switches to light and persists after reload", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Switch to light theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("desktop sidebar navigation reaches portfolio", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await page.getByRole("navigation", { name: "Main" }).first().getByRole("link", { name: "Portfolio" }).click();
    await expect(page).toHaveURL(/\/portfolio$/);
    await expect(page.getByRole("heading", { level: 1, name: "My portfolio" })).toBeVisible();
  });

  test("mobile bottom navigation reaches investments", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await page.getByRole("navigation", { name: "Main" }).last().getByRole("link", { name: "Trade" }).click();
    await expect(page).toHaveURL(/\/invest$/);
  });

  test("investment market filter changes the list", async ({ page }) => {
    await page.goto("/invest?market=IN", { waitUntil: "networkidle" });
    await expect(page.getByText("Reliance Industries")).toBeVisible();
    await expect(page.getByText("Apple Inc.")).toHaveCount(0);
  });

  test("order tabs switch views", async ({ page }) => {
    await page.goto("/invest/orders?tab=cancelled", { waitUntil: "networkidle" });
    await expect(page.getByText("Cancelled", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Cancelled" })).toHaveAttribute("aria-current", "page");
  });
});
