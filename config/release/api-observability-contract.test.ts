import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { API_ROUTE_OBSERVABILITY } from "../../src/lib/observability/api-route-registry.js";

const API_ROOT = join(process.cwd(), "src/app/api");
const ROUTE_FILE = /\/route\.(?:js|ts)$/;
const ROUTE_METHOD = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS)\s*\(/g;
const ROUTE_TRAILING_SLASH = /\/$/;
const compareText = (left: string, right: string) => left.localeCompare(right);

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function routePattern(file: string) {
  const path = relative(API_ROOT, file).replace(/\\/g, "/").replace(ROUTE_FILE, "");
  return `/api/${path}`.replace(ROUTE_TRAILING_SLASH, "");
}

describe("API observability inventory", () => {
  test("Registers every route module with a closed category and response mode", () => {
    const files = walk(API_ROOT).filter((file) => ROUTE_FILE.test(file));
    const discovered = files.map(routePattern).sort(compareText);
    expect(Object.keys(API_ROUTE_OBSERVABILITY).sort(compareText)).toEqual(discovered);

    const allowedFamilies = new Set([
      "account",
      "ai",
      "auth",
      "contact",
      "content",
      "e2e",
      "inbound",
      "payments",
      "staff-files",
    ]);
    const allowedModes = new Set(["binary", "delegated", "json", "stream"]);
    for (const definition of Object.values(API_ROUTE_OBSERVABILITY)) {
      expect(allowedFamilies.has(definition.family)).toBe(true);
      expect(allowedModes.has(definition.responseMode)).toBe(true);
      expect(definition.methods.length).toBeGreaterThan(0);
    }
  });

  test("Wraps every exported route method exactly once", () => {
    const files = walk(API_ROOT).filter((file) => ROUTE_FILE.test(file));
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const route = routePattern(file);
      const methods = [...source.matchAll(ROUTE_METHOD)].map((match) => match[1]).sort(compareText);
      const definition = API_ROUTE_OBSERVABILITY[route];
      expect(methods, route).toEqual([...definition.methods].sort(compareText));
      expect(source.match(/withApiRequestLogging\s*\(/g)?.length ?? 0, route).toBe(methods.length);
      expect(source.includes(JSON.stringify(route)), route).toBe(true);
      expect(source.includes("logApiEvent"), route).toBe(false);
    }
  });
});
