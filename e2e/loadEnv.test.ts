import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadE2eEnv, parseEnvLineValue } from "./loadEnv";

describe("parseEnvLineValue", () => {
  test("keeps quoted values when an inline comment follows", () => {
    expect(parseEnvLineValue('"seedsecret"   # workflow assertions')).toBe("seedsecret");
  });

  test("strips surrounding quotes from plain assignments", () => {
    expect(parseEnvLineValue('"staffpassword"')).toBe("staffpassword");
  });

  test("keeps explicit process bindings ahead of local defaults", () => {
    const root = mkdtempSync(join(tmpdir(), "citius-e2e-env-"));
    const key = "CITIUS_E2E_ENV_PRECEDENCE_FIXTURE";
    const prior = process.env[key];
    try {
      writeFileSync(join(root, ".env"), `${key}=base\n`);
      writeFileSync(join(root, ".env.local"), `${key}=local\n`);
      process.env[key] = "explicit";
      loadE2eEnv(root);
      expect(process.env[key]).toBe("explicit");
    } finally {
      if (prior === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = prior;
      }
      rmSync(root, { force: true, recursive: true });
    }
  });
});
