import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import type { ScheduledJob } from "../operationalScheduledJobs";
import schema from "../schema";
import { modules } from "../test.setup";
import type { OperationalControlKey } from "./lib/operationalControls";
import { PRODUCTION_TEST_RECIPES, type ProductionTestRecipeId } from "./lib/productionTestRecipes";

const NOW = new Date("2026-08-19T14:00:00.000Z");
const GATEWAY_SECRET = "operational-controls-integration-secret";
const RELEASE_TARGET = {
  expectedTargetDeployment: "local-convex",
  expectedTargetEnvironment: "development",
  expectedTargetRevision: "working-tree",
} as const;
const SCHEDULED_JOB_CONTROLS = [
  ["check_cl_sl_leave_lapse", "jobs.check_cl_sl_leave_lapse"],
  ["cleanup_ai_runtime", "jobs.cleanup_ai_runtime"],
  ["cleanup_passenger_exports", "jobs.cleanup_passenger_exports"],
  ["cleanup_portal_rate_limits", "jobs.cleanup_portal_rate_limits"],
  ["cleanup_sacred_bharat_rate_limits", "jobs.cleanup_sacred_bharat_rate_limits"],
  ["purge_commercial_files", "jobs.purge_commercial_files"],
  ["reconcile_crm_metrics", "jobs.reconcile_crm_metrics"],
  ["reconcile_list_search", "jobs.reconcile_list_search"],
  ["reconcile_proposal_links", "jobs.reconcile_proposal_links"],
  ["reconcile_proposal_relations", "jobs.reconcile_proposal_relations"],
  ["reconcile_query_commercial", "jobs.reconcile_query_commercial"],
  ["run_workflow_nudges", "jobs.run_workflow_nudges"],
] as const satisfies ReadonlyArray<readonly [ScheduledJob, OperationalControlKey]>;

const activateOperationalControlPlane = makeFunctionReference<
  "mutation",
  {
    commandId: string;
    expectedRevision: number;
    expectedTargetDeployment: string;
    expectedTargetEnvironment: string;
    expectedTargetRevision: string;
    reason: string;
  },
  {
    auditEventId: string;
    initializedControlKeys: string[];
    replayed: boolean;
    revision: number;
  }
>("crm/settings:activateOperationalControlPlane");

const listOperationalControls = makeFunctionReference<
  "query",
  { at: number },
  Array<{
    availability: "available" | "unavailable";
    effectiveEnabled: boolean | null;
    expiresAt?: number;
    key: string;
    revision: number;
    source: string;
    state: string;
  }>
>("crm/settings:listOperationalControls");

const getRuntimeHealth = makeFunctionReference<
  "query",
  { at: number },
  {
    aiExperiences: Array<{
      coverage: string;
      grounding: { canonicalTool: number; unknown: number };
      key: string;
      label: string;
      latency: {
        between2And8Seconds: number;
        over8Seconds: number;
        under2Seconds: number;
        unknown: number;
      };
      observedAt: number | null;
      outcomes: { completed: number; failed: number; interrupted: number };
      sampleSize: number;
      status: string;
    }>;
    at: number;
    projections: Array<{
      key: string;
      label: string;
      observedAt: number | null;
      status: string;
      summary: string;
    }>;
    scheduledJobs: Array<{
      key: string;
      label: string;
      observedAt: number | null;
      status: string;
      summary: string;
    }>;
    workflowNudges: {
      key: string;
      label: string;
      observedAt: number | null;
      status: string;
      summary: string;
    };
  }
>("crm/settings:getRuntimeHealth");

const listOperationalEffectReceipts = makeFunctionReference<
  "query",
  { paginationOpts: { cursor: string | null; numItems: number } },
  {
    page: Array<{
      controlKey: string;
      disposition: string;
      effectId: string;
      reason: string;
    }>;
  }
>("crm/settings:listOperationalEffectReceipts");

const resolveOperationalControlsForGateway = makeFunctionReference<
  "mutation",
  {
    gatewaySecret: string;
    keys: Array<
      | "email.crm_workflow"
      | "inbound.crm_intake"
      | "jobs.cleanup_ai_runtime"
      | "jobs.cleanup_passenger_exports"
      | "payments.razorpay"
      | "payments.razorpay_new_order"
    >;
    synthetic?: boolean;
    testScope?: "inbound_contact";
    testToken?: string;
  },
  { controls: Array<{ blockedBy: string[]; enabled: boolean; key: string; reason: string }> }
>("crm/settings:resolveOperationalControlsForGateway");

const runScheduledJob = makeFunctionReference<
  "action",
  { job: ScheduledJob },
  { executed: boolean }
>("operationalScheduledJobs:run");

const applyOperationalChangeSet = makeFunctionReference<
  "mutation",
  {
    changes: Array<{
      expectedRevision: number;
      key: OperationalControlKey;
      state: "default" | "disabled" | "enabled";
    }>;
    commandId: string;
    expectedTargetDeployment: string;
    expectedTargetEnvironment: string;
    expectedTargetRevision: string;
    reason: string;
    restorationAfterMs?: number | null;
    restorationAt?: number | null;
  },
  {
    auditEventId: string;
    changeSetId: string;
    replayed: boolean;
    restorationAt: number | null;
  }
>("crm/settings:applyOperationalChangeSet");

const undoOperationalChangeSet = makeFunctionReference<
  "mutation",
  {
    changeSetId: string;
    commandId: string;
    expectedTargetDeployment: string;
    expectedTargetEnvironment: string;
    expectedTargetRevision: string;
    reason: string;
  },
  { auditEventId: string; changeSetId: string; replayed: boolean }
>("crm/settings:undoOperationalChangeSet");

const restoreOperationalChangeSet = makeFunctionReference<
  "mutation",
  { changeSetId: string },
  { auditEventId?: string; changeSetId: string; replayed: boolean; status: string }
>("crm/settings:restoreOperationalChangeSet");

const listOperationalChangeSets = makeFunctionReference<
  "query",
  { paginationOpts: { cursor: string | null; numItems: number } },
  {
    continueCursor: string;
    isDone: boolean;
    page: Array<{
      _id: string;
      changeCount: number;
      reason: string;
      status: string;
      undoAvailable: boolean;
    }>;
  }
>("crm/settings:listOperationalChangeSets");

const listOperationalControlAudit = makeFunctionReference<
  "query",
  { paginationOpts: { cursor: string | null; numItems: number } },
  {
    continueCursor: string;
    isDone: boolean;
    page: Array<{
      action: string;
      changes: Array<{ key: string }>;
      targetDeployment: string;
      targetEnvironment: string;
      targetRevision: string;
    }>;
  }
>("crm/settings:listOperationalControlAudit");

const migrateOperationalControlCatalog = makeFunctionReference<
  "mutation",
  {
    commandId: string;
    expectedTargetDeployment: string;
    expectedTargetEnvironment: string;
    expectedTargetRevision: string;
    reason: string;
  },
  { initializedControlKeys: string[]; replayed: boolean }
>("crm/settings:migrateOperationalControlCatalog");

const listProductionTestRecipes = makeFunctionReference<"query", Record<string, never>, unknown[]>(
  "crm/productionTestLab:listRecipes"
);
const runProductionTestRecipes = makeFunctionReference<
  "action",
  {
    commandId: string;
    expectedTargetDeployment: string;
    expectedTargetEnvironment: string;
    expectedTargetRevision: string;
    note?: string;
    recipeIds: ProductionTestRecipeId[];
  },
  {
    replayed: boolean;
    run: {
      note?: string;
      results: Array<{ recordedEffects: string[]; status: string; steps: unknown[] }>;
      status: string;
    };
  }
>("crm/productionTestLab:runRecipes");
const beginProductionTestRun = makeFunctionReference<
  "mutation",
  {
    commandId: string;
    expectedTargetDeployment: string;
    expectedTargetEnvironment: string;
    expectedTargetRevision: string;
    note?: string;
    recipeIds: ProductionTestRecipeId[];
  },
  { replayed: boolean; runId: Id<"productionTestRuns">; status: string }
>("crm/productionTestLab:beginRun");

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
      {
        authUserId: "https://auth.citius.test|auth_director_cement",
        email: "director-cement@citius.test",
        name: "Director Cement",
        roles: ["Director Cement"],
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
  process.env.OPERATIONAL_CONTROL_SOURCE_REVISION = RELEASE_TARGET.expectedTargetRevision;
  process.env.OPERATIONAL_CONTROL_TARGET_ID = RELEASE_TARGET.expectedTargetDeployment;
  process.env.VERCEL_ENV = RELEASE_TARGET.expectedTargetEnvironment;
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.OPERATIONAL_CONTROL_GATEWAY_SECRET;
  delete process.env.OPERATIONAL_CONTROL_SOURCE_REVISION;
  delete process.env.OPERATIONAL_CONTROL_TARGET_ID;
  delete process.env.PORTAL_BOOTSTRAP_ADMINS;
  delete process.env.PORTAL_BOOTSTRAP_ADMINS_EXPIRES_AT;
  delete process.env.VERCEL_ENV;
});

describe("registered exact-Admin Operational Controls", () => {
  test("composes bounded privacy-safe runtime evidence for exact Admin only", async () => {
    const t = createHarness();
    await seedStaff(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("operationalEffectReceipts", {
        controlKey: "jobs.cleanup_ai_runtime",
        createdAt: NOW.getTime() - 1000,
        disposition: "created",
        effectId: "effect-id-private-sentinel",
        entityId: "record-id-private-sentinel",
        payloadFingerprint: "a".repeat(64),
        reason: "configured_default",
      });
      await ctx.db.insert("crmMetricReadiness", {
        completedSourceTypes: [],
        generation: 1,
        key: "global",
        lastCompletedAt: NOW.getTime() - 1000,
        lastCompletedGeneration: 1,
        lastCompletedMetricVersion: 4,
        metricVersion: 4,
        startedAt: NOW.getTime() - 2000,
        updatedAt: NOW.getTime() - 1000,
      });
      for (const table of ["queries", "jobCards", "proposals", "travellers"]) {
        await ctx.db.insert("crmListSearchReadiness", {
          ready: true,
          reconciling: false,
          table,
          updatedAt: NOW.getTime() - 1000,
          version: 2,
        });
      }
      await ctx.db.insert("notificationUnreadProjectionReadiness", {
        generation: 1,
        key: "notificationUnread",
        ready: true,
        residuals: 0,
        scanned: 1,
        stage: "complete",
        startedAt: NOW.getTime() - 2000,
        status: "complete",
        updatedAt: NOW.getTime() - 1000,
        version: 1,
      });
      await ctx.db.insert("notificationEmailSummaryReadiness", {
        generation: 1,
        key: "notificationEmailDeliveries",
        ready: true,
        residuals: 0,
        scanned: 1,
        stage: "complete",
        startedAt: NOW.getTime() - 2000,
        status: "complete",
        updatedAt: NOW.getTime() - 1000,
        version: 1,
      });
      await ctx.db.insert("proposalAttachmentSummaryReadiness", {
        generation: 1,
        key: "proposalAttachments",
        ready: true,
        reconciling: false,
        startedAt: NOW.getTime() - 2000,
        updatedAt: NOW.getTime() - 1000,
        version: 1,
      });
      await ctx.db.insert("portalWorkflowNudgeRuns", {
        checked: 1,
        cursor: null,
        failedAt: NOW.getTime() - 1000,
        failureCode: "PRIVATE_FAILURE_CODE",
        failureKind: "deterministic",
        failureMessage: "customer@example.test token-private-sentinel",
        key: "scheduled",
        referenceNow: NOW.getTime(),
        sent: 0,
        stage: "complete",
        startedAt: NOW.getTime() - 2000,
        status: "failed",
        updatedAt: NOW.getTime() - 1000,
      });
      await ctx.db.insert("aiTelemetry", {
        createdAt: NOW.getTime() - 2000,
        fallback: false,
        feature: "concierge",
        groundingCategory: "canonical_tool",
        latencyCategory: "under_2_seconds",
        latencyMs: 1500,
        model: "traveller-private@example.test",
        retentionUntil: NOW.getTime() + 30 * 24 * 60 * 60 * 1000,
        terminalState: "completed",
      });
      await ctx.db.insert("aiTelemetry", {
        createdAt: NOW.getTime() - 1000,
        fallback: true,
        feature: "concierge",
        latencyMs: 9000,
        model: "provider-private-sentinel",
        retentionUntil: NOW.getTime() + 30 * 24 * 60 * 60 * 1000,
        terminalState: "failed",
      });
    });

    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    const asDirector = t.withIdentity(identity("auth_director", "director@citius.test"));
    const asDirectorCement = t.withIdentity(
      identity("auth_director_cement", "director-cement@citius.test")
    );
    const asOrdinary = t.withIdentity(identity("auth_customer", "customer@citius.test"));
    const result = await asAdmin.query(getRuntimeHealth, { at: NOW.getTime() });

    expect(result.projections).toHaveLength(5);
    expect(result.projections.every((item) => item.status === "ready")).toBe(true);
    expect(result.scheduledJobs).toHaveLength(12);
    expect(result.scheduledJobs.find((job) => job.key === "cleanup_ai_runtime")?.status).toBe(
      "ready"
    );
    expect(result.workflowNudges.status).toBe("degraded");
    expect(result.aiExperiences).toEqual([
      expect.objectContaining({
        grounding: { canonicalTool: 1, unknown: 1 },
        key: "concierge",
        latency: {
          between2And8Seconds: 0,
          over8Seconds: 0,
          under2Seconds: 1,
          unknown: 1,
        },
        outcomes: { completed: 1, failed: 1, interrupted: 0 },
        sampleSize: 2,
        status: "observed",
      }),
      expect.objectContaining({ key: "journeyPlanner", sampleSize: 0, status: "unknown" }),
    ]);
    expect(JSON.stringify(result)).not.toContain("effect-id-private-sentinel");
    expect(JSON.stringify(result)).not.toContain("record-id-private-sentinel");
    expect(JSON.stringify(result)).not.toContain("customer@example.test");
    expect(JSON.stringify(result)).not.toContain("token-private-sentinel");
    expect(JSON.stringify(result)).not.toContain("provider-private-sentinel");

    await expect(asDirector.query(getRuntimeHealth, { at: NOW.getTime() })).rejects.toThrow(
      "FORBIDDEN"
    );
    await expect(asDirectorCement.query(getRuntimeHealth, { at: NOW.getTime() })).rejects.toThrow(
      "FORBIDDEN"
    );
    await expect(asOrdinary.query(getRuntimeHealth, { at: NOW.getTime() })).rejects.toThrow(
      "FORBIDDEN"
    );
    await expect(t.query(getRuntimeHealth, { at: NOW.getTime() })).rejects.toThrow("FORBIDDEN");

    delete process.env.OPERATIONAL_CONTROL_TARGET_ID;
    await expect(asAdmin.query(getRuntimeHealth, { at: NOW.getTime() })).rejects.toThrow(
      "OPERATIONAL_CONTROL_TARGET_IDENTITY_UNAVAILABLE"
    );
    process.env.OPERATIONAL_CONTROL_TARGET_ID = RELEASE_TARGET.expectedTargetDeployment;

    process.env.PORTAL_BOOTSTRAP_ADMINS = "bootstrap@citius.test";
    process.env.PORTAL_BOOTSTRAP_ADMINS_EXPIRES_AT = String(NOW.getTime() + 60_000);
    const asBootstrap = t.withIdentity(identity("auth_bootstrap", "bootstrap@citius.test"));
    await expect(asBootstrap.query(getRuntimeHealth, { at: NOW.getTime() })).rejects.toThrow(
      "FORBIDDEN"
    );
  });

  test("projects legacy effect receipts into the current Evidence contract", async () => {
    const t = createHarness();
    await seedStaff(t);
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    await t.run(async (ctx) => {
      const testSessionId = await ctx.db.insert("operationalControlTestSessions", {
        createdAt: NOW.getTime(),
        createdBy: "legacy-admin",
        createdByName: "Legacy admin",
        expiresAt: NOW.getTime() + 60_000,
        overrides: [],
        reason: "Legacy isolated-test evidence.",
        scope: "inbound_contact",
        tokenHash: "legacy-token-hash",
      });
      await ctx.db.insert("operationalEffectReceipts", {
        controlKey: "inbound.crm_intake",
        createdAt: NOW.getTime(),
        disposition: "suppressed",
        effectId: "legacy-effect",
        reason: "test_override",
        synthetic: true,
        testSessionId,
      });
    });

    const result = await asAdmin.query(listOperationalEffectReceipts, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(result.page).toEqual([
      expect.objectContaining({
        controlKey: "inbound.crm_intake",
        disposition: "suppressed",
        effectId: "legacy-effect",
        reason: "test_override",
      }),
    ]);
    expect("synthetic" in result.page[0]).toBe(false);
    expect("testSessionId" in result.page[0]).toBe(false);
  });

  test("runs major-capability dry runs without customer or provider effects", async () => {
    const t = createHarness();
    await seedStaff(t);
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    const asDirector = t.withIdentity(identity("auth_director", "director@citius.test"));

    expect(await asAdmin.query(listProductionTestRecipes, {})).toHaveLength(20);
    const recipeIds = PRODUCTION_TEST_RECIPES.map((recipe) => recipe.id);
    // The recording-only email rehearsals intentionally exercise Effect's timer-backed retry
    // schedule, so this action must not run under the suite's frozen clock.
    vi.useRealTimers();
    const result = await asAdmin.action(runProductionTestRecipes, {
      ...RELEASE_TARGET,
      commandId: "0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b",
      note: "General-purpose dry run with no live effects.",
      recipeIds,
    });
    expect(result.run).toMatchObject({
      note: "General-purpose dry run with no live effects.",
      status: "passed",
    });
    expect(result.run.results).toHaveLength(recipeIds.length);
    expect(result.run.results.every((entry) => entry.status === "passed")).toBe(true);
    expect(result.run.results.every((entry) => entry.recordedEffects.length > 0)).toBe(true);
    expect(result.run.results.flatMap((entry) => entry.recordedEffects).join(" ")).not.toMatch(
      /[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu
    );
    expect(result.run.results.every((entry) => entry.steps.length >= 4)).toBe(true);
    const sideEffects = await t.run(async (ctx) => ({
      authDeliveries: await ctx.db.query("authEmailDeliveries").collect(),
      authIntents: await ctx.db.query("authEmailDeliveryIntents").collect(),
      effects: await ctx.db.query("operationalEffectReceipts").collect(),
      inboundLeads: await ctx.db.query("inboundQueryIntents").collect(),
      notifications: await ctx.db.query("notifications").collect(),
      runs: await ctx.db.query("productionTestRuns").collect(),
    }));
    expect(sideEffects).toMatchObject({
      authDeliveries: [],
      authIntents: [],
      effects: [],
      inboundLeads: [],
      notifications: [],
    });
    expect(sideEffects.runs).toHaveLength(1);
    await expect(
      asDirector.action(runProductionTestRecipes, {
        ...RELEASE_TARGET,
        commandId: "0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c",
        recipeIds: ["inbound_leads"],
      })
    ).rejects.toThrow("FORBIDDEN");
  });

  test("skips a paused major feature without recordings or business writes", async () => {
    const t = createHarness();
    await seedStaff(t);
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    await expect(
      asAdmin.mutation(applyOperationalChangeSet, {
        ...RELEASE_TARGET,
        changes: [{ expectedRevision: 0, key: "ai.concierge", state: "disabled" }],
        commandId: "30303030-3030-4030-8030-303030303030",
        reason: "This target has not completed release setup.",
        restorationAfterMs: null,
      })
    ).rejects.toThrow("OPERATIONAL_CONTROL_RELEASE_SETUP_REQUIRED");
    await asAdmin.mutation(activateOperationalControlPlane, {
      ...RELEASE_TARGET,
      commandId: "09090909-0909-4909-8909-090909090909",
      expectedRevision: 0,
      reason: "Prepare the local target for paused Test Lab proof.",
    });
    await asAdmin.mutation(applyOperationalChangeSet, {
      ...RELEASE_TARGET,
      changes: [{ expectedRevision: 1, key: "inbound.crm_intake", state: "disabled" }],
      commandId: "08080808-0808-4808-8808-080808080808",
      reason: "Pause inbound leads before running its recording-only recipe.",
      restorationAfterMs: null,
    });

    const result = await asAdmin.action(runProductionTestRecipes, {
      ...RELEASE_TARGET,
      commandId: "07070707-0707-4707-8707-070707070707",
      recipeIds: ["inbound_leads"],
    });

    expect(result.run.results).toEqual([
      expect.objectContaining({
        recipeId: "inbound_leads",
        recordedEffects: [],
        status: "skipped",
      }),
    ]);
    const businessRows = await t.run(async (ctx) => ({
      handoffs: await ctx.db.query("crmHandoffEvents").collect(),
      intents: await ctx.db.query("inboundQueryIntents").collect(),
      notifications: await ctx.db.query("notifications").collect(),
    }));
    expect(businessRows).toEqual({ handoffs: [], intents: [], notifications: [] });
  });

  test("recovers an immutable active recipe run and rejects overlapping scope", async () => {
    const t = createHarness();
    await seedStaff(t);
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    const command = {
      ...RELEASE_TARGET,
      commandId: "0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d",
      note: "Recover this immutable inbound run after a reload.",
      recipeIds: ["inbound_leads" as const],
    };
    const active = await asAdmin.mutation(beginProductionTestRun, command);
    expect(active.status).toBe("running");

    await expect(
      asAdmin.action(runProductionTestRecipes, {
        ...RELEASE_TARGET,
        commandId: "0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e",
        recipeIds: ["inbound_leads"],
      })
    ).rejects.toThrow("PRODUCTION_TEST_RUN_ALREADY_ACTIVE");

    const recovered = await asAdmin.action(runProductionTestRecipes, command);
    expect(recovered).toMatchObject({
      replayed: true,
      run: { note: command.note, status: "passed" },
    });
    expect(recovered.run.results).toHaveLength(1);
  });

  test("closes an interrupted Test Lab run after the recovery window", async () => {
    const t = createHarness();
    await seedStaff(t);
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    const interrupted = await asAdmin.mutation(beginProductionTestRun, {
      ...RELEASE_TARGET,
      commandId: "06060606-0606-4606-8606-060606060606",
      recipeIds: ["inbound_leads"],
    });
    vi.setSystemTime(new Date(NOW.getTime() + 16 * 60 * 1000));

    const replacement = await asAdmin.action(runProductionTestRecipes, {
      ...RELEASE_TARGET,
      commandId: "05050505-0505-4505-8505-050505050505",
      recipeIds: ["inbound_leads"],
    });

    expect(replacement.run.status).toBe("passed");
    const previous = await t.run(async (ctx) =>
      ctx.db.get("productionTestRuns", interrupted.runId)
    );
    expect(previous).toMatchObject({
      results: [expect.objectContaining({ status: "failed" })],
      status: "failed",
    });
  });

  test("rejects invalid Test Lab commands, empty selections, duplicates, and replay conflicts", async () => {
    const t = createHarness();
    await seedStaff(t);
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    const base = {
      ...RELEASE_TARGET,
      commandId: "04040404-0404-4404-8404-040404040404",
      note: "Immutable Test Lab command.",
      recipeIds: ["inbound_leads" as const],
    };

    await expect(
      asAdmin.mutation(beginProductionTestRun, { ...base, commandId: "invalid" })
    ).rejects.toThrow("INVALID_PRODUCTION_TEST_RUN");
    await expect(
      asAdmin.mutation(beginProductionTestRun, { ...base, recipeIds: [] })
    ).rejects.toThrow("INVALID_PRODUCTION_TEST_RUN");
    await expect(
      asAdmin.mutation(beginProductionTestRun, {
        ...base,
        recipeIds: ["inbound_leads", "inbound_leads"],
      })
    ).rejects.toThrow("INVALID_PRODUCTION_TEST_RUN");
    await asAdmin.mutation(beginProductionTestRun, base);
    await expect(
      asAdmin.mutation(beginProductionTestRun, {
        ...base,
        note: "Conflicting Test Lab replay.",
      })
    ).rejects.toThrow("PRODUCTION_TEST_COMMAND_CONFLICT");
  });

  test("retires coarse state without losing incident pauses or migration provenance", async () => {
    const t = createHarness();
    await seedStaff(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("operationalControlPlaneState", {
        activatedAt: NOW.getTime(),
        activatedBy: "release-fixture",
        activatedByName: "Release fixture",
        key: "global",
        reason: "Existing deployment fixture.",
        revision: 1,
      });
      for (const [key, state, expiresAt] of [
        ["email.auth", "disabled", undefined],
        ["files.document_preview_worker", "enabled", undefined],
        ["jobs.scheduled", "safe_default", NOW.getTime() + 60_000],
        ["payments.razorpay", "disabled", NOW.getTime() - 1],
      ] as const) {
        await ctx.db.insert("operationalControlStates", {
          expiresAt,
          key,
          reason: "Existing paused state.",
          revision: 4,
          state,
          updatedAt: NOW.getTime(),
          updatedBy: "release-fixture",
          updatedByName: "Release fixture",
        });
      }
    });
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    const before = await asAdmin.query(listOperationalControls, { at: NOW.getTime() });
    expect(before.find((entry) => entry.key === "email.auth.verification")).toMatchObject({
      effectiveEnabled: false,
      revision: 0,
    });
    expect(before.find((entry) => entry.key === "jobs.cleanup_ai_runtime")).toMatchObject({
      effectiveEnabled: false,
      revision: 0,
    });

    const migrated = await t.mutation(migrateOperationalControlCatalog, {
      ...RELEASE_TARGET,
      commandId: "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a",
      reason: "Retire coarse controls and initialize the precise catalog.",
    });
    expect(migrated.initializedControlKeys).toHaveLength(26);
    const direct = await t.run(async (ctx) => ctx.db.query("operationalControlStates").collect());
    expect(direct.filter((row) => row.key === "email.auth.verification")).toHaveLength(1);
    expect(direct.find((row) => row.key === "email.auth.verification")).toMatchObject({
      reason: "Existing paused state.",
      revision: 4,
      state: "disabled",
      updatedBy: "release-fixture",
    });
    expect(direct.find((row) => row.key === "files.document_preview_preparation")).toMatchObject({
      revision: 4,
      state: "enabled",
    });
    expect(direct.find((row) => row.key === "jobs.cleanup_ai_runtime")).toMatchObject({
      expiresAt: NOW.getTime() + 60_000,
      revision: 4,
      state: "safe_default",
    });
    expect(direct.find((row) => row.key === "payments.razorpay_new_order")).toMatchObject({
      expiresAt: NOW.getTime() - 1,
      revision: 4,
      state: "disabled",
    });
    expect(
      direct.some((row) =>
        [
          "email.auth",
          "files.document_preview_worker",
          "jobs.scheduled",
          "payments.razorpay",
        ].includes(row.key)
      )
    ).toBe(false);
  });

  test("projects retained legacy activity into the current evidence contract", async () => {
    const t = createHarness();
    await seedStaff(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("operationalControlAuditEvents", {
        action: "global_set",
        actorId: "legacy-admin",
        actorName: "Legacy Admin",
        commandId: "legacy-command",
        controlKey: "payments.razorpay",
        createdAt: NOW.getTime(),
        reason: "Retained legacy evidence.",
      });
    });
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));

    const activity = await asAdmin.query(listOperationalControlAudit, {
      paginationOpts: { cursor: null, numItems: 12 },
    });

    expect(activity.page).toContainEqual(
      expect.objectContaining({
        action: "global_set",
        changes: [],
        targetDeployment: "Legacy target not recorded",
        targetEnvironment: "legacy",
        targetRevision: "Legacy revision not recorded",
      })
    );
  });

  test("exposes the independently recoverable catalog with configured state separate from blocking", async () => {
    const t = createHarness();
    await seedStaff(t);
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));

    const catalog = await asAdmin.query(listOperationalControls, { at: NOW.getTime() });

    expect(catalog).toHaveLength(26);
    expect(catalog.map((entry) => entry.key)).toEqual(
      expect.arrayContaining([
        "email.auth.verification",
        "email.auth.password_reset",
        "email.auth.staff_setup",
        "jobs.check_cl_sl_leave_lapse",
        "jobs.cleanup_ai_runtime",
        "jobs.cleanup_passenger_exports",
        "jobs.cleanup_portal_rate_limits",
        "jobs.cleanup_sacred_bharat_rate_limits",
        "jobs.purge_commercial_files",
        "jobs.reconcile_crm_metrics",
        "jobs.reconcile_list_search",
        "jobs.reconcile_proposal_links",
        "jobs.reconcile_proposal_relations",
        "jobs.reconcile_query_commercial",
        "jobs.run_workflow_nudges",
      ])
    );
  });

  test("applies a reviewed multi-control Production Change Set atomically", async () => {
    const t = createHarness();
    await seedStaff(t);
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    await asAdmin.mutation(activateOperationalControlPlane, {
      ...RELEASE_TARGET,
      commandId: "01010101-0101-4101-8101-010101010101",
      expectedRevision: 0,
      reason: "Prepare the release-owned control state for the change-set contract.",
    });
    const longReason = `Provider maintenance details:\n${"context ".repeat(90)}`;

    const applied = await asAdmin.mutation(applyOperationalChangeSet, {
      ...RELEASE_TARGET,
      changes: [
        { expectedRevision: 1, key: "notifications.crm_bell", state: "disabled" },
        { expectedRevision: 1, key: "inbound.sales_bell", state: "enabled" },
      ],
      commandId: "02020202-0202-4202-8202-020202020202",
      reason: longReason,
      restorationAfterMs: null,
    });

    expect(applied).toMatchObject({ replayed: false });
    const catalog = await asAdmin.query(listOperationalControls, { at: NOW.getTime() });
    expect(catalog.find((entry) => entry.key === "notifications.crm_bell")).toMatchObject({
      configuredState: "paused",
      effectiveEnabled: false,
      revision: 2,
    });
    expect(catalog.find((entry) => entry.key === "inbound.sales_bell")).toMatchObject({
      blockedBy: ["notifications.crm_bell"],
      configuredState: "available",
      effectiveEnabled: false,
      revision: 2,
    });

    const history = await asAdmin.query(listOperationalChangeSets, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(history.page[0]).toMatchObject({
      _id: applied.changeSetId,
      changeCount: 2,
      reason: longReason.trim(),
      status: "applied",
    });

    await expect(
      asAdmin.mutation(applyOperationalChangeSet, {
        ...RELEASE_TARGET,
        changes: [
          { expectedRevision: 2, key: "notifications.crm_bell", state: "enabled" },
          { expectedRevision: 1, key: "inbound.sales_bell", state: "disabled" },
        ],
        commandId: "03030303-0303-4303-8303-030303030303",
        reason: "Reject the complete set when one expected revision is stale.",
        restorationAfterMs: null,
      })
    ).rejects.toThrow("STALE_OPERATIONAL_CHANGE_SET");
    const unchanged = await asAdmin.query(listOperationalControls, { at: NOW.getTime() });
    expect(unchanged.find((entry) => entry.key === "notifications.crm_bell")).toMatchObject({
      configuredState: "paused",
      revision: 2,
    });
  });

  test("rejects malformed change sets without evidence writes and enforces command replay identity", async () => {
    const t = createHarness();
    await seedStaff(t);
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    await asAdmin.mutation(activateOperationalControlPlane, {
      ...RELEASE_TARGET,
      commandId: "31313131-3131-4131-8131-313131313131",
      expectedRevision: 0,
      reason: "Prepare release state for change-set rejection proof.",
    });
    const validChange = {
      expectedRevision: 1,
      key: "ai.concierge" as const,
      state: "disabled" as const,
    };
    const base = {
      ...RELEASE_TARGET,
      changes: [validChange],
      commandId: "32323232-3232-4232-8232-323232323232",
      reason: "Pause Concierge for replay proof.",
      restorationAfterMs: null,
    };
    const before = await t.run(async (ctx) => ({
      audits: (await ctx.db.query("operationalControlAuditEvents").collect()).length,
      changeSets: (await ctx.db.query("operationalControlChangeSets").collect()).length,
    }));

    await expect(
      asAdmin.mutation(applyOperationalChangeSet, { ...base, commandId: "not-a-command" })
    ).rejects.toThrow("INVALID_OPERATIONAL_CONTROL_COMMAND");
    await expect(
      asAdmin.mutation(applyOperationalChangeSet, { ...base, reason: "   " })
    ).rejects.toThrow("OPERATIONAL_CONTROL_REASON_REQUIRED");
    await expect(
      asAdmin.mutation(applyOperationalChangeSet, { ...base, changes: [] })
    ).rejects.toThrow("INVALID_OPERATIONAL_CHANGE_SET");
    await expect(
      asAdmin.mutation(applyOperationalChangeSet, {
        ...base,
        changes: [validChange, validChange],
      })
    ).rejects.toThrow("INVALID_OPERATIONAL_CHANGE_SET");
    await expect(
      asAdmin.mutation(applyOperationalChangeSet, {
        ...base,
        restorationAfterMs: 60_000,
      })
    ).rejects.toThrow("INVALID_OPERATIONAL_CONTROL_EXPIRY");

    const afterRejections = await t.run(async (ctx) => ({
      audits: (await ctx.db.query("operationalControlAuditEvents").collect()).length,
      changeSets: (await ctx.db.query("operationalControlChangeSets").collect()).length,
    }));
    expect(afterRejections).toEqual(before);

    const applied = await asAdmin.mutation(applyOperationalChangeSet, base);
    await expect(asAdmin.mutation(applyOperationalChangeSet, base)).resolves.toEqual({
      ...applied,
      replayed: true,
    });
    await expect(
      asAdmin.mutation(applyOperationalChangeSet, {
        ...base,
        reason: "A conflicting retry must not reuse the command.",
      })
    ).rejects.toThrow("OPERATIONAL_CONTROL_COMMAND_CONFLICT");
  });

  test("automatically restores the complete preceding state once", async () => {
    const t = createHarness();
    await seedStaff(t);
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    await asAdmin.mutation(activateOperationalControlPlane, {
      ...RELEASE_TARGET,
      commandId: "04040404-0404-4404-8404-040404040404",
      expectedRevision: 0,
      reason: "Prepare the release-owned control state for restoration proof.",
    });
    const applied = await asAdmin.mutation(applyOperationalChangeSet, {
      ...RELEASE_TARGET,
      changes: [
        { expectedRevision: 1, key: "ai.concierge", state: "disabled" },
        { expectedRevision: 1, key: "email.crm_workflow", state: "disabled" },
      ],
      commandId: "05050505-0505-4505-8505-050505050505",
      reason: "Pause two capabilities during a bounded provider investigation.",
      restorationAt: NOW.getTime() + 30 * 60 * 1000,
    });
    expect(applied.restorationAt).toBe(NOW.getTime() + 30 * 60 * 1000);
    if (applied.restorationAt === null) {
      throw new Error("Expected the server-authoritative restoration deadline.");
    }

    vi.setSystemTime(new Date(applied.restorationAt + 1));
    const restored = await t.mutation(restoreOperationalChangeSet, {
      changeSetId: applied.changeSetId,
    });
    expect(restored).toMatchObject({ replayed: false, status: "restored" });
    await expect(
      t.mutation(restoreOperationalChangeSet, { changeSetId: applied.changeSetId })
    ).resolves.toMatchObject({ replayed: true, status: "restored" });

    const catalog = await asAdmin.query(listOperationalControls, {
      at: applied.restorationAt + 1,
    });
    expect(catalog.find((entry) => entry.key === "ai.concierge")).toMatchObject({
      configuredState: "normal",
      effectiveEnabled: true,
    });
    expect(catalog.find((entry) => entry.key === "email.crm_workflow")).toMatchObject({
      configuredState: "normal",
      effectiveEnabled: true,
    });
  });

  test("allows one-shot Undo only for the latest still-current Production Change Set", async () => {
    const t = createHarness();
    await seedStaff(t);
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    await asAdmin.mutation(activateOperationalControlPlane, {
      ...RELEASE_TARGET,
      commandId: "06060606-0606-4606-8606-060606060606",
      expectedRevision: 0,
      reason: "Prepare the release-owned control state for Undo proof.",
    });
    const applied = await asAdmin.mutation(applyOperationalChangeSet, {
      ...RELEASE_TARGET,
      changes: [{ expectedRevision: 1, key: "ai.journey_planner", state: "disabled" }],
      commandId: "07070707-0707-4707-8707-070707070707",
      reason: "Pause Journey Planner while checking its provider contract.",
      restorationAfterMs: null,
    });

    const undone = await asAdmin.mutation(undoOperationalChangeSet, {
      ...RELEASE_TARGET,
      changeSetId: applied.changeSetId,
      commandId: "08080808-0808-4808-8808-080808080808",
      reason: "Resume the preceding Journey Planner behavior after review.",
    });
    expect(undone).toMatchObject({ changeSetId: applied.changeSetId, replayed: false });
    await expect(
      asAdmin.mutation(undoOperationalChangeSet, {
        ...RELEASE_TARGET,
        changeSetId: applied.changeSetId,
        commandId: "09090909-0909-4909-8909-090909090909",
        reason: "A completed Undo cannot be repeated.",
      })
    ).rejects.toThrow("OPERATIONAL_CHANGE_SET_UNDO_UNAVAILABLE");

    const catalog = await asAdmin.query(listOperationalControls, { at: NOW.getTime() });
    expect(catalog.find((entry) => entry.key === "ai.journey_planner")).toMatchObject({
      configuredState: "normal",
      effectiveEnabled: true,
    });
    const activity = await asAdmin.query(listOperationalControlAudit, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(activity.page.map((event) => event.action)).toEqual([
      "change_set_undone",
      "change_set_applied",
      "plane_activated",
    ]);
    expect(activity.page[0]).toMatchObject({
      changes: [{ key: "ai.journey_planner" }],
      targetDeployment: RELEASE_TARGET.expectedTargetDeployment,
      targetEnvironment: RELEASE_TARGET.expectedTargetEnvironment,
      targetRevision: RELEASE_TARGET.expectedTargetRevision,
    });
  });

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
      source: "pre_activation_standard",
      state: "missing",
    });
    expect(catalog.find((entry) => entry.key === "email.crm_workflow")).toMatchObject({
      availability: "available",
      effectiveEnabled: true,
      revision: 0,
      source: "pre_activation_standard",
      state: "missing",
    });
    expect(
      catalog
        .filter((entry) => entry.availability === "available")
        .every((entry) => entry.effectiveEnabled === true)
    ).toBe(true);
    expect(catalog.find((entry) => entry.key === "jobs.cleanup_ai_runtime")).toMatchObject({
      availability: "available",
      effectiveEnabled: true,
      source: "pre_activation_standard",
    });
    await expect(asDirector.query(listOperationalControls, { at: NOW.getTime() })).rejects.toThrow(
      "FORBIDDEN"
    );
  });

  test("binds release-only setup to the exact target and records one atomic activation", async () => {
    const t = createHarness();
    await seedStaff(t);

    await expect(
      t.mutation(activateOperationalControlPlane, {
        ...RELEASE_TARGET,
        commandId: "10101010-1010-4010-8010-101010101010",
        expectedRevision: 0,
        expectedTargetDeployment: "wrong-target",
        reason: "This target mismatch must not initialize any live controls.",
      })
    ).rejects.toThrow("OPERATIONAL_CONTROL_TARGET_MISMATCH");

    const activated = await t.mutation(activateOperationalControlPlane, {
      ...RELEASE_TARGET,
      commandId: "11111111-1010-4010-8010-101010101010",
      expectedRevision: 0,
      reason: "Initialize the exact local release target for source verification.",
    });
    expect(activated.initializedControlKeys).toHaveLength(26);
    const persisted = await t.run(async (ctx) => ({
      audits: await ctx.db.query("operationalControlAuditEvents").collect(),
      markers: await ctx.db.query("operationalControlPlaneState").collect(),
      states: await ctx.db.query("operationalControlStates").collect(),
    }));
    expect(persisted.markers).toHaveLength(1);
    expect(persisted.states).toHaveLength(26);
    expect(persisted.audits).toContainEqual(
      expect.objectContaining({ action: "plane_activated", actorName: "Release setup" })
    );
  });

  test("offers Undo only for the newest still-current change set, including disjoint controls", async () => {
    const t = createHarness();
    await seedStaff(t);
    await t.mutation(activateOperationalControlPlane, {
      ...RELEASE_TARGET,
      commandId: "12121212-1010-4010-8010-101010101010",
      expectedRevision: 0,
      reason: "Initialize the local release target for latest-Undo proof.",
    });
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    const first = await asAdmin.mutation(applyOperationalChangeSet, {
      ...RELEASE_TARGET,
      changes: [{ expectedRevision: 1, key: "ai.concierge", state: "disabled" }],
      commandId: "13131313-1010-4010-8010-101010101010",
      reason: "Pause Concierge before a separate Journey Planner decision.",
      restorationAfterMs: null,
    });
    vi.setSystemTime(new Date(NOW.getTime() + 1));
    const second = await asAdmin.mutation(applyOperationalChangeSet, {
      ...RELEASE_TARGET,
      changes: [{ expectedRevision: 1, key: "ai.journey_planner", state: "disabled" }],
      commandId: "14141414-1010-4010-8010-101010101010",
      reason: "Pause Journey Planner as the latest operational decision.",
      restorationAfterMs: null,
    });

    const history = await asAdmin.query(listOperationalChangeSets, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(history.page.filter((row) => row.undoAvailable)).toHaveLength(1);
    expect(history.page.find((row) => row.undoAvailable)?._id).toBe(second.changeSetId);
    await expect(
      asAdmin.mutation(undoOperationalChangeSet, {
        ...RELEASE_TARGET,
        changeSetId: first.changeSetId,
        commandId: "15151515-1010-4010-8010-101010101010",
        reason: "Historical disjoint changes must remain view-only.",
      })
    ).rejects.toThrow("OPERATIONAL_CHANGE_SET_UNDO_UNAVAILABLE");
  });

  test("shows temporary state and records a diagnosable all-or-nothing restoration conflict", async () => {
    const t = createHarness();
    await seedStaff(t);
    await t.mutation(activateOperationalControlPlane, {
      ...RELEASE_TARGET,
      commandId: "16161616-1010-4010-8010-101010101010",
      expectedRevision: 0,
      reason: "Initialize the local release target for restoration-conflict proof.",
    });
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    const restorationAt = NOW.getTime() + 30 * 60 * 1000;
    const applied = await asAdmin.mutation(applyOperationalChangeSet, {
      ...RELEASE_TARGET,
      changes: [
        { expectedRevision: 1, key: "ai.concierge", state: "disabled" },
        { expectedRevision: 1, key: "ai.journey_planner", state: "disabled" },
      ],
      commandId: "17171717-1010-4010-8010-101010101010",
      reason: "Temporarily pause both AI entry points and restore them together.",
      restorationAfterMs: 30 * 60 * 1000,
    });
    const temporaryCatalog = await asAdmin.query(listOperationalControls, { at: NOW.getTime() });
    expect(temporaryCatalog.find((row) => row.key === "ai.concierge")?.expiresAt).toBe(
      restorationAt
    );

    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("operationalControlStates")
        .withIndex("by_key", (index) => index.eq("key", "ai.journey_planner"))
        .unique();
      if (!row) {
        throw new Error("Expected Journey Planner state.");
      }
      await ctx.db.patch("operationalControlStates", row._id, { revision: row.revision + 1 });
    });
    vi.setSystemTime(new Date(restorationAt + 1));
    await expect(
      t.mutation(restoreOperationalChangeSet, { changeSetId: applied.changeSetId })
    ).resolves.toMatchObject({ status: "restoration_failed" });

    const evidence = await t.run(async (ctx) => ({
      audits: await ctx.db.query("operationalControlAuditEvents").collect(),
      states: await ctx.db.query("operationalControlStates").collect(),
    }));
    expect(evidence.audits).toContainEqual(
      expect.objectContaining({
        action: "change_set_restoration_failed",
        changeSetId: applied.changeSetId,
      })
    );
    expect(evidence.states.find((row) => row.key === "ai.concierge")).toMatchObject({
      changeSetId: applied.changeSetId,
      state: "disabled",
    });
  });

  test("resolves each scheduled job independently at its real execution gateway", async () => {
    const t = createHarness();
    await seedStaff(t);
    await t.mutation(activateOperationalControlPlane, {
      ...RELEASE_TARGET,
      commandId: "18181818-1010-4010-8010-101010101010",
      expectedRevision: 0,
      reason: "Initialize the local release target for individual scheduled-job proof.",
    });
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    await asAdmin.mutation(applyOperationalChangeSet, {
      ...RELEASE_TARGET,
      changes: [{ expectedRevision: 1, key: "jobs.cleanup_ai_runtime", state: "disabled" }],
      commandId: "19191919-1010-4010-8010-101010101010",
      reason: "Pause only AI cleanup while leaving the other eleven scheduled jobs available.",
      restorationAfterMs: null,
    });

    expect(
      await t.mutation(resolveOperationalControlsForGateway, {
        gatewaySecret: GATEWAY_SECRET,
        keys: ["jobs.cleanup_ai_runtime", "jobs.cleanup_passenger_exports"],
      })
    ).toMatchObject({
      controls: [
        { enabled: false, key: "jobs.cleanup_ai_runtime" },
        { enabled: true, key: "jobs.cleanup_passenger_exports" },
      ],
    });
  });

  test("keeps normal mixed-deployment gateway calls compatible while retiring test overrides", async () => {
    const t = createHarness();
    await seedStaff(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("operationalControlPlaneState", {
        activatedAt: NOW.getTime(),
        activatedBy: "release-fixture",
        activatedByName: "Release fixture",
        key: "global",
        reason: "Mixed deployment fixture.",
        revision: 1,
      });
      await ctx.db.insert("operationalControlStates", {
        key: "payments.razorpay",
        reason: "Pause provider order creation during the rolling deployment.",
        revision: 2,
        state: "disabled",
        updatedAt: NOW.getTime(),
        updatedBy: "release-fixture",
        updatedByName: "Release fixture",
      });
    });

    await expect(
      t.mutation(resolveOperationalControlsForGateway, {
        gatewaySecret: GATEWAY_SECRET,
        keys: ["payments.razorpay"],
        synthetic: false,
      })
    ).resolves.toMatchObject({
      controls: [{ enabled: false, key: "payments.razorpay" }],
    });
    await expect(
      t.mutation(resolveOperationalControlsForGateway, {
        gatewaySecret: GATEWAY_SECRET,
        keys: ["payments.razorpay_new_order"],
      })
    ).resolves.toMatchObject({
      controls: [{ enabled: false, key: "payments.razorpay_new_order" }],
    });
    await expect(
      t.mutation(resolveOperationalControlsForGateway, {
        gatewaySecret: GATEWAY_SECRET,
        keys: ["payments.razorpay"],
        synthetic: true,
      })
    ).rejects.toThrow("OPERATIONAL_TEST_OVERRIDE_RETIRED");
  });

  test("suppresses and records every one of the twelve scheduled jobs at execution time", async () => {
    const t = createHarness();
    await seedStaff(t);
    await t.mutation(activateOperationalControlPlane, {
      ...RELEASE_TARGET,
      commandId: "20202020-1010-4010-8010-101010101010",
      expectedRevision: 0,
      reason: "Initialize the local release target for all scheduled-job enforcement proof.",
    });
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    await asAdmin.mutation(applyOperationalChangeSet, {
      ...RELEASE_TARGET,
      changes: SCHEDULED_JOB_CONTROLS.map(([, key]) => ({
        expectedRevision: 1,
        key,
        state: "disabled" as const,
      })),
      commandId: "21212121-1010-4010-8010-101010101010",
      reason: "Pause all twelve job dispatches together to prove each named execution gate.",
      restorationAfterMs: null,
    });

    for (const [job] of SCHEDULED_JOB_CONTROLS) {
      await expect(t.action(runScheduledJob, { job })).resolves.toEqual({ executed: false });
    }
    const receipts = await t.run(async (ctx) =>
      ctx.db.query("operationalEffectReceipts").collect()
    );
    expect(receipts).toHaveLength(12);
    expect(new Set(receipts.map((receipt) => receipt.controlKey))).toEqual(
      new Set(SCHEDULED_JOB_CONTROLS.map(([, key]) => key))
    );
    expect(receipts.every((receipt) => receipt.disposition === "suppressed")).toBe(true);
  });
});
