import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import robots from "./robots.js";

const APP_ROOT = resolve(import.meta.dir);
const originalEnvironment = process.env.VERCEL_ENV;

/** Route folders under src/app, with route groups like (auth) flattened away. */
function routeFolderExists(prefix) {
  const segments = prefix.split("/").filter(Boolean);
  const search = (directory, remaining) => {
    if (remaining.length === 0) {
      return true;
    }
    const [next, ...rest] = remaining;
    if (existsSync(resolve(directory, next)) && search(resolve(directory, next), rest)) {
      return true;
    }
    return readdirSync(directory, { withFileTypes: true }).some(
      (entry) =>
        entry.isDirectory() &&
        entry.name.startsWith("(") &&
        search(resolve(directory, entry.name), remaining)
    );
  };
  return search(APP_ROOT, segments);
}

afterEach(() => {
  process.env.VERCEL_ENV = originalEnvironment;
});

describe("Production robots policy", () => {
  test("Disallows every real private route prefix and no phantom ones", () => {
    process.env.VERCEL_ENV = "production";
    const [rule] = robots().rules;

    expect(rule.allow).toBe("/");
    expect(rule.disallow).not.toContain("/admin");
    for (const prefix of [
      "/account",
      "/api/",
      "/app/invite",
      "/app/sign-in",
      "/auth",
      "/portal",
      "/vendor",
    ]) {
      expect(rule.disallow).toContain(prefix);
    }
    for (const prefix of rule.disallow) {
      expect(routeFolderExists(prefix), prefix).toBe(true);
    }
  });

  test("Keeps public pages crawlable", () => {
    process.env.VERCEL_ENV = "production";
    const [rule] = robots().rules;
    for (const publicPath of ["/", "/pilgrimage", "/sacred-bharat", "/blog", "/apple-icon.png"]) {
      expect(
        rule.disallow.some((prefix) => publicPath.startsWith(prefix)),
        publicPath
      ).toBe(false);
    }
  });

  test("Blocks everything outside Production", () => {
    process.env.VERCEL_ENV = "preview";
    expect(robots().rules).toEqual([{ disallow: "/", userAgent: "*" }]);
  });
});
