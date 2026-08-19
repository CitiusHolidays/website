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
      source: "missing_safe_default",
      state: "missing",
    });
    expect(catalog.find((entry) => entry.key === "email.crm_workflow")).toMatchObject({
      availability: "available",
      effectiveEnabled: false,
      revision: 0,
      source: "missing_safe_default",
      state: "missing",
    });
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
      effectiveEnabled: false,
      revision: 2,
      state: "safe_default",
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
});
