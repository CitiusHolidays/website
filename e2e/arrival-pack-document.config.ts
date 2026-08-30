import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  fullyParallel: false,
  outputDir: "../.scratch/arrival-pack-playwright",
  projects: [{ name: "arrival-pack-chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: "list",
  testDir: "./specs",
  testMatch: "customer-account-arrival-pack-document.spec.ts",
  timeout: 30_000,
  workers: 1,
});
