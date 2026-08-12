import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.BROWSER_SMOKE_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  outputDir: ".scratch/e2e-public/results",
  projects: [
    {
      name: "public-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: [["list"], ["html", { open: "never", outputFolder: ".scratch/e2e-public/report" }]],
  retries: process.env.CI ? 1 : 0,
  testDir: "./e2e/public",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    viewport: { height: 900, width: 1440 },
  },
  webServer: {
    command: "bun run dev",
    reuseExistingServer: true,
    timeout: 120_000,
    url: baseURL,
  },
  workers: 1,
});
