import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

export const ARRIVAL_PACK_DOCUMENT_VIEWPORT = { height: 900, width: 320 } as const;

export default defineConfig({
  fullyParallel: false,
  outputDir: resolve(".scratch/arrival-pack-playwright"),
  projects: [{ name: "arrival-pack-chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: "list",
  testDir: resolve("e2e/specs"),
  testMatch: "customer-account-arrival-pack-document.spec.ts",
  timeout: 30_000,
  workers: 1,
});
