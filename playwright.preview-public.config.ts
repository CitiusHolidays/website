import { defineConfig, devices } from "@playwright/test";
import { vercelProtectionHeaders } from "./config/e2e/vercel-protection";

const baseURL = process.env.BROWSER_SMOKE_BASE_URL;
if (!baseURL) {
  throw new Error("BROWSER_SMOKE_BASE_URL is required for Preview public evidence");
}

export default defineConfig({
  expect: { timeout: 15_000 },
  forbidOnly: true,
  fullyParallel: false,
  outputDir: ".scratch/e2e-preview-public/results",
  projects: [
    {
      name: "preview-public-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: [["list"], ["./e2e/reporters/evidenceReporter.ts"]],
  retries: 1,
  testDir: "./e2e/specs",
  testMatch: "public-interface-accessibility.spec.ts",
  timeout: 60_000,
  use: {
    baseURL,
    extraHTTPHeaders: vercelProtectionHeaders(),
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    viewport: { height: 1000, width: 1440 },
  },
  workers: 1,
});
