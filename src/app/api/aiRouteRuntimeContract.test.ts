import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const routes = ["src/app/api/chat/route.js", "src/app/api/sacred-bharat/journey-planner/route.js"];

describe("public AI route runtime contract", () => {
  test("both routes use shared limits, bounded provider streams, cancellation, and telemetry", () => {
    for (const route of routes) {
      const source = readFileSync(join(root, route), "utf8");
      expect(source).toContain("consumeSharedAiRateLimit");
      expect(source).toContain("createAiProviderResponse");
      expect(source).toContain("recordAiTelemetry");
      expect(source).toContain("signal: req.signal");
      expect(source).toContain("providerAttemptTimeoutMs");
      expect(source).not.toContain("new Map(");
      expect(source).not.toContain("maxRetries: 2");
      expect(source).not.toContain("gpt-oss-120b");
    }
  });
});
