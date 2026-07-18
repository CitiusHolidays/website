import { defineConfig, devices } from "@playwright/test";
import { loadE2eEnv } from "./e2e/loadEnv";

loadE2eEnv();

const baseURL = process.env.BROWSER_SMOKE_BASE_URL ?? "http://localhost:3000";
const isCi = Boolean(process.env.CI);
const configuredWorkers = Number.parseInt(process.env.PLAYWRIGHT_WORKERS ?? "", 10);
// Default to one worker: critical-path is serial and all specs share one Convex dev deployment.
const workers = Number.isFinite(configuredWorkers) && configuredWorkers > 0 ? configuredWorkers : 1;

export default defineConfig({
  expect: {
    timeout: 15_000,
  },
  forbidOnly: isCi,
  fullyParallel: workers > 1,
  globalSetup: "./e2e/global-setup.ts",
  outputDir: ".scratch/playwright-results",
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  reporter: isCi ? [["github"], ["html", { open: "never" }]] : [["list"]],
  retries: isCi ? 1 : 0,
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    viewport: { height: 1000, width: 1440 },
  },
  workers,
});
