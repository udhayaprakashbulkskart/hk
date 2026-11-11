import { test, expect } from "@playwright/test";

test.describe("authentication screens", () => {
  test("login validates input and continues to verification", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("Enter your email or mobile number");
    await page.getByLabel("Email or mobile number").fill("customer@example.com");
    await page.getByLabel("Password").fill("not-a-real-password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/verify\?purpose=login/);
  });

  test("OTP accepts a pasted 6-digit code and moves to the dashboard", async ({ page }) => {
    await page.goto("/verify?purpose=login", { waitUntil: "networkidle" });
    const first = page.getByLabel("Digit 1 of 6");
    await first.focus();
    await page.evaluate(() => {
      const el = document.querySelector<HTMLInputElement>('input[aria-label="Digit 1 of 6"]')!;
      const dt = new DataTransfer();
      dt.setData("text", "123456");
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await expect(page.getByLabel("Digit 6 of 6")).toHaveValue("6");
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("registration blocks weak passwords", async ({ page }) => {
    await page.goto("/register", { waitUntil: "networkidle" });
    await page.getByLabel("Full name").fill("Sample Customer");
    await page.getByLabel("Email").fill("sample@example.com");
    await page.getByLabel("Mobile number").fill("55550123");
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("at least 12 characters");
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
    await expect(page.getByText("Transfer pending confirmation")).toBeVisible();
    await expect(page.getByText("Sandbox: no money has moved")).toBeVisible();
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
