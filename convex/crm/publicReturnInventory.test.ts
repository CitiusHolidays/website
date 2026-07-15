import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const MIGRATED_MODULES = [
  "activity.ts",
  "approvals.ts",
  "dashboard.ts",
  "expenseAttachmentActions.ts",
  "expenseAttachments.ts",
  "finance.ts",
  "importActions.ts",
  "imports.ts",
  "jobCards.ts",
  "leave.ts",
  "leaveApprovers.ts",
  "leaveLapse.ts",
  "listSearch.ts",
  "navShortcuts.ts",
  "ops.ts",
  "passport.ts",
  "passportActions.ts",
  "proposalAttachmentActions.ts",
  "proposalAttachments.ts",
  "proposals.ts",
  "queries.ts",
  "queryAttachmentActions.ts",
  "queryAttachments.ts",
  "reports.ts",
  "settings.ts",
  "staff.ts",
  "staffAction.ts",
  "staffImport.ts",
  "staffWorkbookUpdates.ts",
  "travellers.ts",
  "ticketing.ts",
  "visa.ts",
] as const;

const PUBLIC_REGISTRATION = /export\s+const\s+(\w+)\s*=\s*(query|mutation|action)\s*\(\{/g;

function registeredBlocks(source: string) {
  return Array.from(source.matchAll(PUBLIC_REGISTRATION), (match) => {
    const start = match.index ?? 0;
    let depth = 0;
    let end = start;
    for (let index = source.indexOf("{", start); index < source.length; index += 1) {
      if (source[index] === "{") {
        depth += 1;
      } else if (source[index] === "}") {
        depth -= 1;
        if (depth === 0) {
          end = index + 1;
          break;
        }
      }
    }
    return { block: source.slice(start, end), kind: match[2], name: match[1] };
  });
}

describe("migrated CRM public return inventory", () => {
  for (const moduleName of MIGRATED_MODULES) {
    test(`${moduleName} declares narrow returns for every public registration`, () => {
      const source = readFileSync(new URL(`./${moduleName}`, import.meta.url), "utf8");
      const registrations = registeredBlocks(source);
      expect(registrations.length).toBeGreaterThan(0);
      for (const registration of registrations) {
        expect(registration.block, `${moduleName}:${registration.name}`).toContain("returns:");
        expect(registration.block, `${moduleName}:${registration.name}`).not.toMatch(
          /returns:\s*v\.(?:any|optional)\(v\.any\(\)\)/
        );
      }
    });
  }
});
