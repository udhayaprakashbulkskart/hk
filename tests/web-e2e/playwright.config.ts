import { defineConfig, devices } from "@playwright/test";

const CHROMIUM = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

export default defineConfig({
  testDir: "./specs",
  timeout: 60_000,
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "off",
    launchOptions: { executablePath: CHROMIUM, args: ["--no-sandbox"] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "pnpm --dir ../../apps/web start",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
