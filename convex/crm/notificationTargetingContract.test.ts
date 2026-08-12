import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { Glob } from "bun";

const LEGACY_NOTIFICATION_CALL = /\b(?:notifyRoles|notifyStaffMatching|notifyStaffMember)\s*\(/;

describe("notification targeting contract", () => {
  test("production CRM workflows use the explicit two-channel publisher", async () => {
    const glob = new Glob("convex/crm/**/*.ts");
    const productionPaths = Array.from(
      glob.scanSync({ cwd: process.cwd(), onlyFiles: true })
    ).filter((path) => !path.endsWith(".test.ts") && path !== "convex/crm/lib/notifications.ts");
    const legacyCallers = (
      await Promise.all(
        productionPaths.map(async (path) => ({ path, source: await readFile(path, "utf8") }))
      )
    ).flatMap(({ path, source }) => (LEGACY_NOTIFICATION_CALL.test(source) ? [path] : []));

    expect(legacyCallers).toEqual([]);
  });

  test("email copy does not imply that every email has a matching bell row", async () => {
    const source = await readFile(new URL("./notificationEmails.ts", import.meta.url), "utf8");

    expect(source).not.toContain("mirrors an in-app notification");
    expect(source).toContain("Sign in to review the full record and take action.");
  });
});
