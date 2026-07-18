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
  test("lists seven browser-smoke aligned profiles with stable emails", () => {
    const seeds = listE2eStaffProfileSeeds();
    expect(seeds).toHaveLength(7);
    expect([...seeds.map((seed) => seed.key)].sort((a, b) => a.localeCompare(b))).toEqual(
      ["admin", "contracting", "finance", "hr", "operations", "sales", "ticketing"].sort((a, b) =>
        a.localeCompare(b)
      )
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
});
