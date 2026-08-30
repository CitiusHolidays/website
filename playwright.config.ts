import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";
import {
  vercelProtectionBrowserHeaders,
  vercelProtectionHeaders,
} from "./config/e2e/vercel-protection";
import arrivalPackDocumentConfig from "./e2e/arrival-pack-document.config";
import { loadE2eEnv } from "./e2e/loadEnv";

export type PlaywrightProfile =
  | "arrival-pack-document"
  | "default"
  | "preview-public"
  | "public-instant";

function parseWorkers(environment: NodeJS.ProcessEnv) {
  const configuredWorkers = Number.parseInt(environment.PLAYWRIGHT_WORKERS ?? "", 10);
  return Number.isFinite(configuredWorkers) && configuredWorkers > 0 ? configuredWorkers : 1;
}

function createDefaultConfig(environment: NodeJS.ProcessEnv): PlaywrightTestConfig {
  loadE2eEnv();
  const baseURL = environment.BROWSER_SMOKE_BASE_URL ?? "http://localhost:3000";
  const isCi = Boolean(environment.CI);
  const workers = parseWorkers(environment);

  return {
    expect: { timeout: 15_000 },
    forbidOnly: isCi,
    fullyParallel: workers > 1,
    globalSetup: "./e2e/global-setup.ts",
    globalTeardown: "./e2e/global-teardown.ts",
    outputDir: ".scratch/playwright-results",
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    reporter: isCi
      ? [["github"], ["html", { open: "never" }], ["./e2e/reporters/evidenceReporter.ts"]]
      : [["list"], ["./e2e/reporters/evidenceReporter.ts"]],
    retries: isCi ? 1 : 0,
    testDir: "./e2e",
    testMatch: "**/*.spec.ts",
    timeout: 60_000,
    use: {
      baseURL,
      extraHTTPHeaders: vercelProtectionBrowserHeaders(),
      screenshot: "only-on-failure",
      trace: "retain-on-failure",
      video: "retain-on-failure",
      viewport: { height: 1000, width: 1440 },
    },
    workers,
  };
}

function createPublicInstantConfig(environment: NodeJS.ProcessEnv): PlaywrightTestConfig {
  const baseURL = environment.BROWSER_SMOKE_BASE_URL ?? "http://localhost:3000";

  return {
    expect: { timeout: 15_000 },
    forbidOnly: Boolean(environment.CI),
    fullyParallel: false,
    outputDir: ".scratch/e2e-public/results",
    projects: [{ name: "public-chromium", use: { ...devices["Desktop Chrome"] } }],
    reporter: [["list"], ["html", { open: "never", outputFolder: ".scratch/e2e-public/report" }]],
    retries: environment.CI ? 1 : 0,
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
  };
}

function createPreviewPublicConfig(environment: NodeJS.ProcessEnv): PlaywrightTestConfig {
  const baseURL = environment.BROWSER_SMOKE_BASE_URL;
  if (!baseURL) {
    throw new Error("BROWSER_SMOKE_BASE_URL is required for Preview public evidence");
  }

  return {
    expect: { timeout: 15_000 },
    forbidOnly: true,
    fullyParallel: false,
    outputDir: ".scratch/e2e-preview-public/results",
    projects: [{ name: "preview-public-chromium", use: { ...devices["Desktop Chrome"] } }],
    reporter: [["list"], ["./e2e/reporters/evidenceReporter.ts"]],
    retries: 1,
    testDir: "./e2e",
    testMatch: [
      "specs/public-interface-accessibility.spec.ts",
      "public/sacred-bharat-edition.spec.ts",
    ],
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
  };
}

export function createPlaywrightConfig(
  selectedProfile: PlaywrightProfile,
  environment: NodeJS.ProcessEnv = process.env
): PlaywrightTestConfig {
  switch (selectedProfile) {
    case "arrival-pack-document":
      return arrivalPackDocumentConfig;
    case "default":
      return createDefaultConfig(environment);
    case "preview-public":
      return createPreviewPublicConfig(environment);
    case "public-instant":
      return createPublicInstantConfig(environment);
    default:
      throw new Error(`Unsupported Playwright profile: ${selectedProfile}`);
  }
}

function resolveProfile(value: string | undefined): PlaywrightProfile {
  if (value === undefined || value === "default") {
    return "default";
  }
  if (
    value === "arrival-pack-document" ||
    value === "preview-public" ||
    value === "public-instant"
  ) {
    return value;
  }
  throw new Error(`Unknown CITIUS_PLAYWRIGHT_PROFILE: ${value}`);
}

const profile = resolveProfile(process.env.CITIUS_PLAYWRIGHT_PROFILE);
export default defineConfig(createPlaywrightConfig(profile));
