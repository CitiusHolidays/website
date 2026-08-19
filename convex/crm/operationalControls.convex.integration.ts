import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "../schema";
import { modules } from "../test.setup";

const NOW = new Date("2026-08-19T14:00:00.000Z");
const GATEWAY_SECRET = "operational-controls-integration-secret";

const listOperationalControls = makeFunctionReference<
  "query",
  { at: number },
  Array<{
    availability: "available" | "unavailable";
    effectiveEnabled: boolean | null;
    key: string;
    revision: number;
    source: string;
    state: string;
  }>
>("crm/settings:listOperationalControls");

const setOperationalControl = makeFunctionReference<
  "mutation",
  {
    commandId: string;
    expectedRevision: number;
    expiresAt: number | null;
    key: "email.crm_workflow";
    reason: string;
    state: "default" | "enabled" | "disabled";
  },
  { auditEventId: string; replayed: boolean; revision: number }
>("crm/settings:setOperationalControl");

const rollbackOperationalControl = makeFunctionReference<
  "mutation",
  {
    auditEventId: string;
    commandId: string;
    expectedRevision: number;
    reason: string;
  },
  { replayed: boolean; revision: number }
>("crm/settings:rollbackOperationalControl");

const createOperationalTestOverride = makeFunctionReference<
  "mutation",
  {
    commandId: string;
    overrides: Array<{ key: "email.crm_workflow"; state: "enabled" | "disabled" }>;
    reason: string;
    scope: "inbound_contact";
  },
  { expiresAt: number; replayed: boolean; sessionId: string; token: string }
>("crm/settings:createOperationalTestOverride");

const resolveOperationalControlsForGateway = makeFunctionReference<
  "mutation",
  {
    gatewaySecret: string;
    keys: "email.crm_workflow"[];
    synthetic: boolean;
    testScope?: "inbound_contact";
    testToken?: string;
  },
  { controls: Array<{ enabled: boolean; key: string; reason: string }> }
>("crm/settings:resolveOperationalControlsForGateway");

const revokeOperationalTestOverride = makeFunctionReference<
  "mutation",
  { commandId: string; reason: string; sessionId: string },
  { replayed: boolean; sessionId: string }
>("crm/settings:revokeOperationalTestOverride");

const listOperationalTestOverrides = makeFunctionReference<"query", { at: number }, unknown[]>(
  "crm/settings:listOperationalTestOverrides"
);

const listOperationalControlAudit = makeFunctionReference<
  "query",
  {
    controlKey?: "email.crm_workflow";
    paginationOpts: { cursor: string | null; numItems: number };
  },
  unknown
>("crm/settings:listOperationalControlAudit");

const listOperationalEffectReceipts = makeFunctionReference<
  "query",
  {
    controlKey?: "email.crm_workflow";
    paginationOpts: { cursor: string | null; numItems: number };
  },
  unknown
>("crm/settings:listOperationalEffectReceipts");

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

async function seedStaff(t: ReturnType<typeof createHarness>) {
  await t.run(async (ctx) => {
    for (const fixture of [
      {
        authUserId: "https://auth.citius.test|auth_admin",
        email: "admin@citius.test",
        name: "Admin",
        roles: ["Admin"],
      },
      {
        authUserId: "https://auth.citius.test|auth_director",
        email: "director@citius.test",
        name: "Director",
        roles: ["Directors"],
      },
    ] as const) {
      await ctx.db.insert("staffUsers", {
        active: true,
        authUserId: fixture.authUserId,
        createdAt: NOW.getTime(),
        email: fixture.email,
        emailNormalized: fixture.email,
        name: fixture.name,
        roles: [...fixture.roles],
        updatedAt: NOW.getTime(),
      });
    }
  });
}

function identity(subject: string, email: string) {
  return {
    email,
    issuer: "https://auth.citius.test",
    subject,
    tokenIdentifier: `https://auth.citius.test|${subject}`,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  process.env.OPERATIONAL_CONTROL_GATEWAY_SECRET = GATEWAY_SECRET;
  process.env.OPERATIONAL_CONTROL_TEST_SIGNING_SECRET = "s".repeat(64);
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.OPERATIONAL_CONTROL_GATEWAY_SECRET;
  delete process.env.OPERATIONAL_CONTROL_TEST_SIGNING_SECRET;
});

describe("registered exact-Admin Operational Controls", () => {
  test("lists safe missing-state behavior for Admin while denying Directors", async () => {
    const t = createHarness();
    await seedStaff(t);
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    const asDirector = t.withIdentity(identity("auth_director", "director@citius.test"));

    const catalog = await asAdmin.query(listOperationalControls, { at: NOW.getTime() });
    expect(catalog.find((entry) => entry.key === "inbound.crm_intake")).toMatchObject({
      availability: "available",
      effectiveEnabled: true,
      revision: 0,
      source: "configured_default",
      state: "missing",
    });
    expect(catalog.find((entry) => entry.key === "email.crm_workflow")).toMatchObject({
      availability: "available",
      effectiveEnabled: true,
      revision: 0,
      source: "configured_default",
      state: "missing",
    });
    expect(
      catalog
        .filter((entry) => entry.availability === "available")
        .every((entry) => entry.effectiveEnabled === true)
    ).toBe(true);
    expect(catalog.find((entry) => entry.key === "jobs.scheduled")).toMatchObject({
      availability: "unavailable",
      effectiveEnabled: null,
    });
    await expect(asDirector.query(listOperationalControls, { at: NOW.getTime() })).rejects.toThrow(
      "FORBIDDEN"
    );
  });

  test("replays the same command, rejects stale or conflicting reuse, and rolls back", async () => {
    const t = createHarness();
    await seedStaff(t);
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    const command = {
      commandId: "11111111-1111-4111-8111-111111111111",
      expectedRevision: 0,
      expiresAt: null,
      key: "email.crm_workflow" as const,
      reason: "Enable workflow email after the Preview rehearsal.",
      state: "enabled" as const,
    };

    const first = await asAdmin.mutation(setOperationalControl, command);
    expect(first).toMatchObject({ replayed: false, revision: 1 });
    await expect(asAdmin.mutation(setOperationalControl, command)).resolves.toMatchObject({
      auditEventId: first.auditEventId,
      replayed: true,
      revision: 1,
    });
    await expect(
      asAdmin.mutation(setOperationalControl, {
        ...command,
        state: "disabled",
      })
    ).rejects.toThrow("OPERATIONAL_CONTROL_COMMAND_CONFLICT");
    await expect(
      asAdmin.mutation(setOperationalControl, {
        ...command,
        commandId: "22222222-2222-4222-8222-222222222222",
      })
    ).rejects.toThrow("STALE_OPERATIONAL_CONTROL");

    await expect(
      asAdmin.mutation(rollbackOperationalControl, {
        auditEventId: first.auditEventId,
        commandId: "33333333-3333-4333-8333-333333333333",
        expectedRevision: 1,
        reason: "Restore the prior safe state after verification.",
      })
    ).resolves.toMatchObject({ replayed: false, revision: 2 });
    const catalog = await asAdmin.query(listOperationalControls, { at: NOW.getTime() });
    expect(catalog.find((entry) => entry.key === "email.crm_workflow")).toMatchObject({
      effectiveEnabled: true,
      revision: 2,
      state: "default",
    });
  });

  test("applies a signed 30-minute Test Override only to its synthetic scope", async () => {
    const t = createHarness();
    await seedStaff(t);
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    const created = await asAdmin.mutation(createOperationalTestOverride, {
      commandId: "44444444-4444-4444-8444-444444444444",
      overrides: [{ key: "email.crm_workflow", state: "enabled" }],
      reason: "Exercise one synthetic Contact submission without changing global delivery.",
      scope: "inbound_contact",
    });
    expect(created).toMatchObject({
      expiresAt: NOW.getTime() + 30 * 60 * 1000,
      replayed: false,
      token: expect.stringMatching(/^oct_[a-f0-9]{64}$/),
    });
    await expect(
      asAdmin.mutation(createOperationalTestOverride, {
        commandId: "44444444-4444-4444-8444-444444444444",
        overrides: [{ key: "email.crm_workflow", state: "enabled" }],
        reason: "Exercise one synthetic Contact submission without changing global delivery.",
        scope: "inbound_contact",
      })
    ).resolves.toMatchObject({ replayed: true, sessionId: created.sessionId });

    expect(
      await t.mutation(resolveOperationalControlsForGateway, {
        gatewaySecret: GATEWAY_SECRET,
        keys: ["email.crm_workflow"],
        synthetic: true,
        testScope: "inbound_contact",
        testToken: created.token,
      })
    ).toMatchObject({
      controls: [{ enabled: true, key: "email.crm_workflow", reason: "test_override" }],
    });
    await expect(
      t.mutation(resolveOperationalControlsForGateway, {
        gatewaySecret: GATEWAY_SECRET,
        keys: ["email.crm_workflow"],
        synthetic: false,
        testToken: created.token,
      })
    ).rejects.toThrow("INVALID_OPERATIONAL_TEST_OVERRIDE");

    vi.setSystemTime(new Date(NOW.getTime() + 30 * 60 * 1000 + 1));
    await expect(
      t.mutation(resolveOperationalControlsForGateway, {
        gatewaySecret: GATEWAY_SECRET,
        keys: ["email.crm_workflow"],
        synthetic: true,
        testScope: "inbound_contact",
        testToken: created.token,
      })
    ).rejects.toThrow("INVALID_OPERATIONAL_TEST_OVERRIDE");
  });

  test("denies every control-plane read and mutation to a non-Admin role", async () => {
    const t = createHarness();
    await seedStaff(t);
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    const asDirector = t.withIdentity(identity("auth_director", "director@citius.test"));
    const global = await asAdmin.mutation(setOperationalControl, {
      commandId: "55555555-5555-4555-8555-555555555555",
      expectedRevision: 0,
      expiresAt: null,
      key: "email.crm_workflow",
      reason: "Create a valid audit target for denial coverage.",
      state: "enabled",
    });
    const session = await asAdmin.mutation(createOperationalTestOverride, {
      commandId: "66666666-6666-4666-8666-666666666666",
      overrides: [{ key: "email.crm_workflow", state: "disabled" }],
      reason: "Create a valid test session for denial coverage.",
      scope: "inbound_contact",
    });
    const page = { cursor: null, numItems: 10 };

    await expect(
      asDirector.mutation(setOperationalControl, {
        commandId: "77777777-7777-4777-8777-777777777777",
        expectedRevision: 1,
        expiresAt: null,
        key: "email.crm_workflow",
        reason: "A Director must not change an Admin-only control.",
        state: "disabled",
      })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      asDirector.mutation(rollbackOperationalControl, {
        auditEventId: global.auditEventId,
        commandId: "88888888-8888-4888-8888-888888888888",
        expectedRevision: 1,
        reason: "A Director must not roll back an Admin-only control.",
      })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      asDirector.mutation(createOperationalTestOverride, {
        commandId: "99999999-9999-4999-8999-999999999999",
        overrides: [{ key: "email.crm_workflow", state: "disabled" }],
        reason: "A Director must not create an Admin-only Test Override.",
        scope: "inbound_contact",
      })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      asDirector.mutation(revokeOperationalTestOverride, {
        commandId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        reason: "A Director must not revoke an Admin-only Test Override.",
        sessionId: session.sessionId,
      })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      asDirector.query(listOperationalTestOverrides, { at: NOW.getTime() })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      asDirector.query(listOperationalControlAudit, { paginationOpts: page })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      asDirector.query(listOperationalEffectReceipts, { paginationOpts: page })
    ).rejects.toThrow("FORBIDDEN");
  });

  test("revokes a Test Override immediately and rejects its signed token", async () => {
    const t = createHarness();
    await seedStaff(t);
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    const created = await asAdmin.mutation(createOperationalTestOverride, {
      commandId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      overrides: [{ key: "email.crm_workflow", state: "enabled" }],
      reason: "Exercise revocation of a scoped synthetic session.",
      scope: "inbound_contact",
    });

    await expect(
      asAdmin.mutation(revokeOperationalTestOverride, {
        commandId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        reason: "End the synthetic rehearsal immediately.",
        sessionId: created.sessionId,
      })
    ).resolves.toMatchObject({ replayed: false, sessionId: created.sessionId });
    await expect(
      t.mutation(resolveOperationalControlsForGateway, {
        gatewaySecret: GATEWAY_SECRET,
        keys: ["email.crm_workflow"],
        synthetic: true,
        testScope: "inbound_contact",
        testToken: created.token,
      })
    ).rejects.toThrow("INVALID_OPERATIONAL_TEST_OVERRIDE");
  });

  test("reports duplicate state as corrupt and preserves fail-safe resolution", async () => {
    const t = createHarness();
    await seedStaff(t);
    await t.run(async (ctx) => {
      for (const key of ["inbound.crm_intake", "email.crm_workflow"] as const) {
        for (const state of ["enabled", "disabled"] as const) {
          await ctx.db.insert("operationalControlStates", {
            key,
            reason: "Deliberately corrupt duplicate fixture.",
            revision: state === "enabled" ? 1 : 2,
            state,
            updatedAt: NOW.getTime(),
            updatedBy: "fixture",
            updatedByName: "Fixture",
          });
        }
      }
    });
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    const catalog = await asAdmin.query(listOperationalControls, { at: NOW.getTime() });

    expect(catalog.find((entry) => entry.key === "inbound.crm_intake")).toMatchObject({
      effectiveEnabled: true,
      source: "corrupt_safe_default",
      state: "corrupt",
    });
    expect(catalog.find((entry) => entry.key === "email.crm_workflow")).toMatchObject({
      effectiveEnabled: false,
      source: "corrupt_safe_default",
      state: "corrupt",
    });
  });
});
