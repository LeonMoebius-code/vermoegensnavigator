import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 60_000,
  expect: { timeout: 5_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173/vermoegensnavigator/",
    viewport: { width: 1440, height: 1000 },
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "node scripts/serve-browser-build.mjs",
    url: "http://127.0.0.1:4173/vermoegensnavigator/",
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
