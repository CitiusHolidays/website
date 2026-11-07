import type { WithoutSystemFields } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

// Synthetic test-domain staff only.
const ISSUER = "https://auth.citius.test";
const NOW = new Date("2026-03-30T06:00:00.000Z");

function identity(subject: string, email = `${subject}@citius.test`) {
  return { email, issuer: ISSUER, name: subject, subject, tokenIdentifier: `${ISSUER}|${subject}` };
}

type StaffSeed = "linked" | "unlinked" | "none" | "inactive";

async function seededHarness(seed: StaffSeed) {
  const t = convexTest({ modules, schema, transactionLimits: true });
  if (seed !== "none") {
    const member: WithoutSystemFields<Doc<"staffUsers">> = {
      active: seed !== "inactive",
      createdAt: NOW.getTime(),
      email: "asha@citius.test",
      emailNormalized: "asha@citius.test",
      name: "Asha",
      roles: ["Sales"],
      updatedAt: NOW.getTime(),
    };
    if (seed === "linked" || seed === "inactive") {
      member.authUserId = `${ISSUER}|asha`;
    }
    await t.run(async (ctx) => {
      await ctx.db.insert("staffUsers", member);
    });
  }
  return t;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Portal sign-in bootstrap in one call", () => {
  test.each(["linked", "unlinked", "none", "inactive"] satisfies StaffSeed[])(
    "matches sync-then-read access for a %s staff record",
    async (seed) => {
      const before = await seededHarness(seed);
      const asBefore = before.withIdentity(identity("asha"));
      await asBefore.mutation(api.authSync.syncMyAuthIdentity, {});
      const expected = await asBefore.query(api.crm.staff.getMyPortalAccess, {});

      const after = await seededHarness(seed);
      const asAfter = after.withIdentity(identity("asha"));
      const combined = await asAfter.mutation(api.authSync.syncMyPortalAccess, {});

      expect(combined).toEqual(expected);
      // The sync's writes landed too: a later read agrees.
      expect(await asAfter.query(api.crm.staff.getMyPortalAccess, {})).toEqual(expected);
    }
  );

  test("Lets linked active staff into the portal and refuses a signed-out call", async () => {
    const t = await seededHarness("linked");
    const access = await t
      .withIdentity(identity("asha"))
      .mutation(api.authSync.syncMyPortalAccess, {});
    expect(access.allowed).toBe(true);
    await expect(t.mutation(api.authSync.syncMyPortalAccess, {})).rejects.toThrow("UNAUTHORIZED");
  });
});
