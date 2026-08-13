import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AUTH_IDENTITY_DERIVED_REBUILDS,
  AUTH_IDENTITY_FIELD_SPECS,
  authIdentityMigrationRegistryKey,
  classifyStoredIdentity,
} from "./authIdentityMigration";

const SCHEMA_TABLE_LINE_PATTERN = /^ {2}([A-Za-z][A-Za-z0-9]+): defineTable\(\{/;
const SCHEMA_TABLE_START_PATTERN = /^ {2}([A-Za-z][A-Za-z0-9]+): defineTable\(\{/gm;

describe("auth identity migration contract", () => {
  test("classifies canonical, mapped, unresolved, and ambiguous ownership without email inference", () => {
    const linked = [
      {
        canonicalAuthUserId: "issuer-a|subject",
        legacyAuthUserId: "legacy-subject",
        status: "linked" as const,
      },
    ];
    expect(classifyStoredIdentity("issuer-a|subject", linked)).toEqual({
      kind: "canonical_or_marker",
    });
    expect(classifyStoredIdentity("system", linked)).toEqual({ kind: "canonical_or_marker" });
    expect(classifyStoredIdentity("legacy-subject", linked)).toEqual({
      canonicalAuthUserId: "issuer-a|subject",
      kind: "convert",
    });
    expect(classifyStoredIdentity("same@example.com", linked)).toEqual({ kind: "remaining" });
    expect(
      classifyStoredIdentity("legacy-subject", [
        ...linked,
        {
          canonicalAuthUserId: "issuer-b|subject",
          legacyAuthUserId: "legacy-subject",
          status: "linked",
        },
      ])
    ).toEqual({ kind: "quarantine" });
  });

  test("enumerates each auth-owned table once and names derived rebuilds", () => {
    const tables = AUTH_IDENTITY_FIELD_SPECS.map((spec) => spec.table);
    expect(new Set(tables).size).toBe(tables.length);
    expect(tables).toContain("bookings");
    expect(tables).toContain("staffUsers");
    expect(tables).toContain("userProfiles");
    expect(tables).toContain("sacredBharatGroupMembers");
    expect(tables).toContain("notificationReads");
    expect(AUTH_IDENTITY_DERIVED_REBUILDS[0].tables).toContain(
      "notificationUnreadProjectionReadiness"
    );
    expect(authIdentityMigrationRegistryKey("bookings", false)).toBe("auth-identity-v1:bookings");
  });

  test("keeps the explicit inventory aligned with auth-bearing schema fields", () => {
    const schema = readFileSync(join(import.meta.dir, "..", "schema.ts"), "utf8");
    const inventory = new Map(
      AUTH_IDENTITY_FIELD_SPECS.map((spec) => [spec.table, new Set(spec.fields)])
    );
    const authFieldPattern =
      /^ {4}(actorId|archivedAuthUserId|authUserId|createdBy|decidedBy|deletedBy|finalReviewedBy|financeReviewedBy|handedOffBy|headReviewedBy|hrReviewedBy|initiatedBy|invitedBy|lastEditedBy|managerReviewedBy|ownerAuthUserId|recipientUserId|requestedBy|salesOwnerId|updatedBy|userId): v\./gm;
    const excludedTables = new Set([
      "authIdentityLinks",
      "authIdentityQuarantines",
      "e2eRunActors",
    ]);
    let currentTable = "";
    for (const line of schema.split("\n")) {
      const tableMatch = SCHEMA_TABLE_LINE_PATTERN.exec(line);
      if (tableMatch) {
        [, currentTable] = tableMatch;
      }
      authFieldPattern.lastIndex = 0;
      const fieldMatch = authFieldPattern.exec(`${line}\n`);
      if (fieldMatch && !excludedTables.has(currentTable)) {
        expect(inventory.get(currentTable)?.has(fieldMatch[1])).toBe(true);
      }
    }

    const tableStarts = [...schema.matchAll(SCHEMA_TABLE_START_PATTERN)];
    const tableSource = new Map(
      tableStarts.map((match, index) => [
        match[1],
        schema.slice(match.index, tableStarts[index + 1]?.index ?? schema.length),
      ])
    );
    for (const spec of AUTH_IDENTITY_FIELD_SPECS) {
      const source = tableSource.get(spec.table) ?? "";
      for (const index of spec.indexes) {
        expect(source).toContain(`.index("${index}"`);
      }
    }
  });
});
