import { defineConfig, devices } from "@playwright/test";

const CHROMIUM = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

export default defineConfig({
  testDir: "./specs",
  timeout: 90_000,
  workers: 2,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:8081",
    trace: "off",
    launchOptions: { executablePath: CHROMIUM, args: ["--no-sandbox"] },
  },
  projects: [{ name: "phone-web-preview", use: { ...devices["iPhone 14"], defaultBrowserType: "chromium", deviceScaleFactor: 1 } }],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "node serve-export.mjs",
        url: "http://localhost:8081",
        reuseExistingServer: true,
        timeout: 60_000,
        env: { EXPORT_DIR: process.env.EXPORT_DIR ?? "" },
      },
});
