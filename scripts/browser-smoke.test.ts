import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import manifest from "../config/browser-smoke.json";
import {
  type BrowserSmokeCommandRunner,
  type BrowserSmokeManifest,
  evaluateBrowserHealth,
  redactBrowserEvidence,
  resolveBrowserSmokeCases,
  runBrowserSmokeCase,
  validateBrowserSmokeManifest,
} from "./browser-smoke";

const root = resolve(import.meta.dir, "..");

describe("browser smoke harness", () => {
  test("the checked-in manifest has unique valid cases and every critical seam", () => {
    const valid = validateBrowserSmokeManifest(manifest);
    const ids = new Set(valid.cases.map((smokeCase) => smokeCase.id));

    for (const id of [
      "public-home",
      "account-redirect",
      "admin-dashboard",
      "sales-pipeline",
      "sales-queries-pagination",
      "notification-deep-link",
      "job-card-deletion",
      "ai-configured",
      "ai-unconfigured",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  test("authenticated cases require external session identifiers", () => {
    const resolved = resolveBrowserSmokeCases(manifest, {}, new Set(["admin"]));
    const dashboard = resolved.find((item) => item.smokeCase.id === "admin-dashboard");

    expect(dashboard?.status).toBe("skipped");
    expect(dashboard?.reason).toBe("missing BROWSER_SMOKE_ADMIN_SESSION");
  });

  test("exact case selection excludes unrelated optional records from strict runs", () => {
    const resolved = resolveBrowserSmokeCases(
      manifest,
      {},
      new Set(["public"]),
      new Set(["public-home"])
    );
    expect(resolved.find((item) => item.smokeCase.id === "public-home")?.status).toBe(
      "ready" as const
    );
    expect(resolved.find((item) => item.smokeCase.id === "ai-configured")?.status).toBe("excluded");
  });

  test("failure evidence removes credentials and request secrets", () => {
    const sanitized = redactBrowserEvidence(
      "nishit@example.com\nAuthorization: Bearer abc\nCookie: session=abc\n/path?token=abc&code=def"
    );

    expect(sanitized).not.toContain("nishit@example.com");
    expect(sanitized).not.toContain("Bearer abc");
    expect(sanitized).not.toContain("session=abc");
    expect(sanitized).not.toContain("token=abc");
    expect(sanitized).not.toContain("code=def");
  });

  test("fails a matching page when a console error or page error is present", async () => {
    const runner = fixtureRunner({
      console: "[error] Uncaught Error: rendered after heading",
      errors: "No page errors",
    });
    const result = await runBrowserSmokeCase(
      "http://localhost:3000",
      ".scratch/browser-smoke-fixture",
      fixtureManifest,
      fixtureResolved,
      { runCommand: runner, writeArtifact: async () => undefined }
    );

    expect(result).toMatchObject({ status: "failed" });
    expect(result.reason).toContain("console error");
  });

  test("fails a same-origin document or data request while allowing reviewed noise", () => {
    expect(
      evaluateBrowserHealth({
        consoleAllowlist: [],
        consoleOutput: "",
        errorOutput: "",
        networkAllowlist: [],
        networkOutput: "GET http://localhost:3000/api/portal 500 fetch",
        target: "http://localhost:3000/portal",
      })
    ).toEqual([expect.stringContaining("network request")]);
    expect(
      evaluateBrowserHealth({
        consoleAllowlist: [],
        consoleOutput: "",
        errorOutput: "",
        networkAllowlist: ["/api/optional"],
        networkOutput: "GET http://localhost:3000/api/optional 404 xhr",
        target: "http://localhost:3000/portal",
      })
    ).toEqual([]);
  });

  test("turns every inspection subprocess failure into a case result", async () => {
    const failedCommands = ["get url", "read", "console", "errors", "network requests"];
    const results = await Promise.all(
      failedCommands.map((failedCommand) =>
        runBrowserSmokeCase(
          "http://localhost:3000",
          ".scratch/browser-smoke-fixture",
          fixtureManifest,
          fixtureResolved,
          {
            runCommand: fixtureRunner({}, failedCommand),
            writeArtifact: async () => undefined,
          }
        )
      )
    );
    for (const [index, result] of results.entries()) {
      expect(result).toMatchObject({ status: "failed" });
      expect(result.reason).toContain(failedCommands[index] ?? "");
    }
  });

  test("retains the fast read-only pass for a healthy route", async () => {
    const result = await runBrowserSmokeCase(
      "http://localhost:3000",
      ".scratch/browser-smoke-fixture",
      fixtureManifest,
      fixtureResolved,
      { runCommand: fixtureRunner(), writeArtifact: async () => undefined }
    );

    expect(result).toEqual({ id: "fixture", status: "passed" });
  });

  test("help and invalid flags perform no browser or artifact work", () => {
    const run = (args: string[]) =>
      spawnSync("bun", ["scripts/browser-smoke.ts", ...args], {
        cwd: root,
        encoding: "utf8",
        env: { PATH: process.env.PATH },
      });

    const help = run(["--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("Usage: bun run smoke:browser");

    const invalid = run(["--wat"]);
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain("Unknown flag --wat");
  });
});

const fixtureManifest: BrowserSmokeManifest = {
  cases: [],
  profiles: { public: {} },
  viewports: { desktop: { height: 720, width: 1280 } },
};

const fixtureResolved = {
  path: "/",
  session: "fixture-session",
  smokeCase: {
    expectText: "Expected heading",
    id: "fixture",
    path: "/",
    profile: "public",
    viewport: "desktop",
  },
  status: "ready" as const,
};

function fixtureRunner(
  output: Partial<Record<"console" | "errors" | "network", string>> = {},
  failedCommand?: string
): BrowserSmokeCommandRunner {
  return (_session, args) => {
    const command = args.join(" ");
    if (!command.includes("--clear") && command === failedCommand) {
      return Promise.resolve({ exitCode: 2, output: `${command} fixture failure` });
    }
    if (command === "get url") {
      return Promise.resolve({ exitCode: 0, output: "http://localhost:3000/" });
    }
    if (command === "read") {
      return Promise.resolve({ exitCode: 0, output: "Expected heading" });
    }
    if (command === "console") {
      return Promise.resolve({ exitCode: 0, output: output.console ?? "" });
    }
    if (command === "errors") {
      return Promise.resolve({ exitCode: 0, output: output.errors ?? "" });
    }
    if (command === "network requests") {
      return Promise.resolve({
        exitCode: 0,
        output: output.network ?? "GET http://localhost:3000/ 200 document",
      });
    }
    return Promise.resolve({ exitCode: 0, output: "" });
  };
}
