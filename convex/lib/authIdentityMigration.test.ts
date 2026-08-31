import { describe, expect, test } from "bun:test";
import {
  AUTH_IDENTITY_DERIVED_REBUILDS,
  AUTH_IDENTITY_FIELD_SPECS,
  authIdentityMigrationRegistryKey,
  classifyStoredIdentity,
} from "./authIdentityMigration";

describe("Auth identity migration", () => {
  test("Classifies canonical, mapped, unresolved, and ambiguous ownership without email inference", () => {
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

  test("Enumerates each auth-owned table once and names derived rebuilds", () => {
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

  test("Leaves Staff relationship ids to the Staff assignment migration", () => {
    const querySpec = AUTH_IDENTITY_FIELD_SPECS.find((spec) => spec.table === "queries");
    const proposalLinkSpec = AUTH_IDENTITY_FIELD_SPECS.find(
      (spec) => spec.table === "proposalQueryLinks"
    );

    expect(querySpec?.fields).not.toContain("salesOwnerId");
    expect(proposalLinkSpec?.fields).not.toContain("salesOwnerId");
  });
});
