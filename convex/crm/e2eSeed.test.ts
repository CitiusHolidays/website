import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listE2eStaffProfileSeeds } from "./e2eStaffProfiles";

const ROOT = join(import.meta.dir, "../..");
const manifest = JSON.parse(readFileSync(join(ROOT, "config/e2e-staff-profiles.json"), "utf8")) as {
  emailDomain: string;
  profiles: Array<{ key: string; localPart: string; name: string; roles: string[] }>;
};

describe("e2e staff profile seeds", () => {
  test("lists workflow and browser profiles with stable emails", () => {
    const seeds = listE2eStaffProfileSeeds();
    expect(seeds).toHaveLength(12);
    expect([...seeds.map((seed) => seed.key)].sort((a, b) => a.localeCompare(b))).toEqual(
      [
        "admin",
        "accounts",
        "contracting",
        "contracting-cement",
        "finance",
        "hr",
        "leave-head",
        "operations",
        "sales",
        "sales-cement",
        "ticketing",
        "ticketing-head",
      ].sort((a, b) => a.localeCompare(b))
    );
    for (const seed of seeds) {
      expect(seed.email.endsWith(`@${manifest.emailDomain}`)).toBe(true);
      expect(seed.emailNormalized).toBe(seed.email.toLowerCase());
    }
  });

  test("matches config/e2e-staff-profiles.json", () => {
    const seeds = listE2eStaffProfileSeeds();
    expect(seeds).toEqual(
      manifest.profiles.map((profile) => ({
        email: `${profile.localPart}@${manifest.emailDomain}`,
        emailNormalized: `${profile.localPart}@${manifest.emailDomain}`,
        key: profile.key,
        name: profile.name,
        roles: profile.roles,
      }))
    );
  });

  test("rotates existing credential passwords and creates missing credential accounts", () => {
    const source = readFileSync(join(ROOT, "convex/crm/e2eSeedActions.ts"), "utf8");
    expect(source).toContain("await ensureCredentialPassword(ctx, authUserId, args.password)");
    expect(source).toContain("const passwordHash = await hashPassword(password)");
    expect(source).toContain('model: "account"');
    expect(source).toContain("password: passwordHash");
    expect(source).toContain("components.betterAuth.adapter.updateOne");
    expect(source).toContain("components.betterAuth.adapter.create");
  });

  test("seeds an operations-owned Job Card for isolated traveller workflows", () => {
    const source = readFileSync(join(ROOT, "convex/crm/e2eFixtures.ts"), "utf8");

    expect(source).toContain('jobCode: "JC-E2E-WORKFLOW-EO"');
    expect(source).toContain("operationsOwnerId: operations._id");
    expect(source).toContain('insertE2eFixtureWithOwnership(ctx, args.runId, "jobCards"');
  });

  test("keeps the incomplete Proposal fixture relation projection current", () => {
    const source = readFileSync(join(ROOT, "convex/crm/e2eFixtures.ts"), "utf8");

    expect(source).toContain("...proposalLinkProjection(linkedQuery)");
    expect(source).toContain("proposalLinkedQuerySummary([linkedQuery])");
  });
});
