import { fromAny } from "@total-typescript/shoehorn";
import { type DefaultFunctionArgs, makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "../schema";
import { modules } from "../test.setup";
import { assertCrmCodeSourceMutationAllowed, nextCode } from "./lib/codes";

const SECRET = "code-sequence-migration-secret";
const TARGET_BINDING = {
  expectedTargetDeployment: "development:code-sequence-test",
  expectedTargetEnvironment: "development",
  expectedTargetRevision: "code-sequence-test-revision",
} as const;
const TARGET_RESULT = {
  targetDeployment: TARGET_BINDING.expectedTargetDeployment,
  targetEnvironment: TARGET_BINDING.expectedTargetEnvironment,
  targetRevision: TARGET_BINDING.expectedTargetRevision,
} as const;
interface TargetBoundArgs extends DefaultFunctionArgs {
  expectedTargetDeployment: string;
  expectedTargetEnvironment: "development" | "preview" | "production";
  expectedTargetRevision: string;
  secret: string;
}
const inventorySequence = makeFunctionReference<
  "mutation",
  TargetBoundArgs & { limit?: number; tableName: "queries" },
  {
    anomalies: number;
    applied: boolean;
    cursor: string | null;
    key: string;
    maximumObserved: number;
    processed: number;
    processedThisPage: number;
    sequenceLastAllocated: number | null;
    stage: "complete" | "inventory" | "ready" | "reset";
    status: "failed" | "running" | "verified";
    tableName: "queries";
    targetDeployment: string;
    targetEnvironment: "development" | "preview" | "production";
    targetRevision: string;
  }
>("crm/codeSequenceMigration:inventoryCrmCodeSequenceSeed");
const applySequence = makeFunctionReference<
  "mutation",
  TargetBoundArgs & { tableName: "queries" },
  {
    anomalies: number;
    applied: boolean;
    cursor: string | null;
    key: string;
    maximumObserved: number;
    processed: number;
    processedThisPage: number;
    sequenceLastAllocated: number | null;
    stage: "complete" | "inventory" | "ready" | "reset";
    status: "failed" | "running" | "verified";
    tableName: "queries";
    targetDeployment: string;
    targetEnvironment: "development" | "preview" | "production";
    targetRevision: string;
  }
>("crm/codeSequenceMigration:applyCrmCodeSequenceSeed");
const listAnomalies = makeFunctionReference<
  "query",
  TargetBoundArgs & {
    paginationOpts: { cursor: string | null; numItems: number };
    tableName: "queries";
  },
  {
    continueCursor: string;
    isDone: boolean;
    page: {
      allocation?: number;
      code: string;
      kind: "duplicate" | "malformed";
      sourceId: string;
    }[];
    targetDeployment: string;
    targetEnvironment: "development" | "preview" | "production";
    targetRevision: string;
  }
>("crm/codeSequenceMigration:listCrmCodeSequenceInventoryAnomalies");

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

function runInventory(
  t: ReturnType<typeof createHarness>,
  args: { limit?: number; secret: string; tableName: "queries" }
) {
  return t.mutation(inventorySequence, { ...TARGET_BINDING, ...args });
}

function runApply(
  t: ReturnType<typeof createHarness>,
  args: { secret: string; tableName: "queries" }
) {
  return t.mutation(applySequence, { ...TARGET_BINDING, ...args });
}

function readAnomalies(
  t: ReturnType<typeof createHarness>,
  args: {
    paginationOpts: { cursor: string | null; numItems: number };
    secret: string;
    tableName: "queries";
  }
) {
  return t.query(listAnomalies, { ...TARGET_BINDING, ...args });
}

async function seedLegacyQueries(t: ReturnType<typeof createHarness>, count: number) {
  for (let offset = 0; offset < count; offset += 100) {
    await t.run(async (ctx) => {
      const pageSize = Math.min(100, count - offset);
      for (let index = 0; index < pageSize; index += 1) {
        const allocation = offset + index + 1;
        await ctx.db.insert("queries", {
          clientName: `Legacy sequence client ${allocation}`,
          contractingStatus: "Query Received",
          createdAt: allocation,
          createdBy: "migration-fixture",
          paxCount: 1,
          queryCode: `Q-${String(allocation).padStart(4, "0")}`,
          queryType: "FIT",
          salesStatus: "Proposal in discussion",
          travelType: "Domestic Travel",
          updatedAt: allocation,
        });
      }
    });
  }
}

async function allocateQuery(t: ReturnType<typeof createHarness>, clientName: string) {
  return await t.run(async (ctx) => {
    const queryCode = await nextCode(fromAny(ctx), "queries", "Q");
    await ctx.db.insert("queries", {
      clientName,
      contractingStatus: "Query Received",
      createdAt: Date.now(),
      createdBy: "migration-fixture",
      paxCount: 1,
      queryCode,
      queryType: "FIT",
      salesStatus: "Proposal in discussion",
      travelType: "Domestic Travel",
      updatedAt: Date.now(),
    });
    return queryCode;
  });
}

beforeEach(() => {
  vi.stubEnv("MIGRATION_SECRET", SECRET);
  vi.stubEnv("OPERATIONAL_CONTROL_SOURCE_REVISION", TARGET_BINDING.expectedTargetRevision);
  vi.stubEnv("OPERATIONAL_CONTROL_TARGET_ID", TARGET_BINDING.expectedTargetDeployment);
  vi.stubEnv("VERCEL_ENV", TARGET_BINDING.expectedTargetEnvironment);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("CRM code sequence seed migration", () => {
  test("rejects inventory and apply without the migration capability", async () => {
    const t = createHarness();
    await expect(
      runInventory(t, {
        limit: 10,
        secret: "wrong-secret",
        tableName: "queries",
      })
    ).rejects.toThrow("Invalid migration secret");
    await expect(runApply(t, { secret: "wrong-secret", tableName: "queries" })).rejects.toThrow(
      "Invalid migration secret"
    );
  });

  test("rejects a valid secret for the wrong target without mutating migration state", async () => {
    const t = createHarness();
    await seedLegacyQueries(t, 1);
    await expect(
      t.mutation(inventorySequence, {
        ...TARGET_BINDING,
        expectedTargetDeployment: "development:wrong-target",
        limit: 10,
        secret: SECRET,
        tableName: "queries",
      })
    ).rejects.toThrow("OPERATIONAL_CONTROL_TARGET_MISMATCH");
    await t.run(async (ctx) => {
      expect(await ctx.db.query("dataMigrationRegistry").collect()).toEqual([]);
      expect(await ctx.db.query("crmCodeSequenceTrust").collect()).toEqual([]);
      expect(await ctx.db.query("crmCodeSequenceInventoryAllocations").collect()).toEqual([]);
      expect(await ctx.db.query("crmCodeSequenceInventoryAnomalies").collect()).toEqual([]);
    });

    await expect(
      runInventory(t, { limit: 10, secret: SECRET, tableName: "queries" })
    ).resolves.toMatchObject({ ...TARGET_RESULT, maximumObserved: 1, stage: "ready" });
    const before = await t.run(async (ctx) => ({
      allocations: await ctx.db.query("crmCodeSequenceInventoryAllocations").collect(),
      anomalies: await ctx.db.query("crmCodeSequenceInventoryAnomalies").collect(),
      registries: await ctx.db.query("dataMigrationRegistry").collect(),
      sequences: await ctx.db.query("crmCodeSequences").collect(),
      trust: await ctx.db.query("crmCodeSequenceTrust").collect(),
    }));
    await expect(
      t.mutation(applySequence, {
        ...TARGET_BINDING,
        expectedTargetDeployment: "development:wrong-target",
        secret: SECRET,
        tableName: "queries",
      })
    ).rejects.toThrow("OPERATIONAL_CONTROL_TARGET_MISMATCH");
    await expect(
      t.run(async (ctx) => ({
        allocations: await ctx.db.query("crmCodeSequenceInventoryAllocations").collect(),
        anomalies: await ctx.db.query("crmCodeSequenceInventoryAnomalies").collect(),
        registries: await ctx.db.query("dataMigrationRegistry").collect(),
        sequences: await ctx.db.query("crmCodeSequences").collect(),
        trust: await ctx.db.query("crmCodeSequenceTrust").collect(),
      }))
    ).resolves.toEqual(before);
  });

  test("resumes bounded inventory and applies one durable high-water mark idempotently", async () => {
    const t = createHarness();
    await seedLegacyQueries(t, 525);

    let inventory = await runInventory(t, {
      limit: 73,
      secret: SECRET,
      tableName: "queries",
    });
    let pages = 1;
    expect(inventory.processedThisPage).toBeLessThanOrEqual(73);
    while (inventory.stage === "inventory") {
      inventory = await runInventory(t, {
        limit: 73,
        secret: SECRET,
        tableName: "queries",
      });
      expect(inventory.processedThisPage).toBeLessThanOrEqual(73);
      pages += 1;
    }
    expect(pages).toBeGreaterThan(1);
    expect(inventory).toMatchObject({
      ...TARGET_RESULT,
      applied: false,
      cursor: null,
      maximumObserved: 525,
      processed: 525,
      sequenceLastAllocated: null,
      stage: "ready",
      status: "running",
    });
    await t.run(async (ctx) => {
      expect(await ctx.db.query("crmCodeSequences").collect()).toEqual([]);
    });

    await expect(
      runInventory(t, { limit: 1, secret: SECRET, tableName: "queries" })
    ).resolves.toMatchObject({ processed: 525, processedThisPage: 0, stage: "ready" });
    await expect(runApply(t, { secret: SECRET, tableName: "queries" })).resolves.toMatchObject({
      applied: true,
      maximumObserved: 525,
      sequenceLastAllocated: 525,
      stage: "complete",
      status: "verified",
    });
    await expect(runApply(t, { secret: SECRET, tableName: "queries" })).resolves.toMatchObject({
      applied: false,
      sequenceLastAllocated: 525,
    });

    await expect(t.run(async (ctx) => nextCode(fromAny(ctx), "queries", "Q"))).resolves.toBe(
      "Q-0526"
    );
    vi.stubEnv("OPERATIONAL_CONTROL_SOURCE_REVISION", "next-source-revision");
    await expect(t.run(async (ctx) => nextCode(fromAny(ctx), "queries", "Q"))).resolves.toBe(
      "Q-0527"
    );
    vi.stubEnv("OPERATIONAL_CONTROL_SOURCE_REVISION", TARGET_BINDING.expectedTargetRevision);
    await expect(runApply(t, { secret: SECRET, tableName: "queries" })).resolves.toMatchObject({
      applied: false,
      sequenceLastAllocated: 527,
    });
    await t.run(async (ctx) => {
      const registry = await ctx.db.query("dataMigrationRegistry").unique();
      expect(registry).toMatchObject({
        checkpoint: 525,
        converted: 1,
        cursor: null,
        legacyRemaining: 0,
        processed: 525,
        stage: "complete",
        status: "verified",
      });
      const sequence = await ctx.db.query("crmCodeSequences").unique();
      expect(sequence).toMatchObject({
        key: "queries:Q",
        lastAllocated: 527,
        legacyRowsScanned: 525,
      });
      expect(await ctx.db.query("crmCodeSequenceTrust").unique()).toMatchObject({
        key: "queries:Q",
        lastAllocated: 527,
        reconciliationRequired: false,
        version: "crm-code-sequence-seed-v1",
      });
    });
  });

  test("fences allocation before, during, and after inventory until apply", async () => {
    const t = createHarness();
    await seedLegacyQueries(t, 3);

    await expect(
      t.run(async (ctx) => assertCrmCodeSourceMutationAllowed(fromAny(ctx), "queries"))
    ).rejects.toThrow("CRM code source queries is locked for bounded reconciliation");
    await expect(t.run(async (ctx) => nextCode(fromAny(ctx), "queries", "Q"))).rejects.toThrow(
      "CRM code sequence queries:Q requires bounded reconciliation"
    );
    await t.run(async (ctx) => {
      await ctx.db.insert("crmCodeSequences", {
        key: "queries:Q",
        lastAllocated: 1,
        legacyRowsScanned: 1,
        seededAt: 1,
        updatedAt: 1,
      });
    });
    await expect(t.run(async (ctx) => nextCode(fromAny(ctx), "queries", "Q"))).rejects.toThrow(
      "CRM code sequence queries:Q requires bounded reconciliation"
    );
    await expect(
      t.run(async (ctx) => assertCrmCodeSourceMutationAllowed(fromAny(ctx), "queries"))
    ).rejects.toThrow("CRM code source queries is locked for bounded reconciliation");
    let inventory = await runInventory(t, {
      limit: 1,
      secret: SECRET,
      tableName: "queries",
    });
    expect(inventory.stage).toBe("inventory");
    await t.run(async (ctx) => {
      expect(await ctx.db.query("crmCodeSequenceTrust").unique()).toMatchObject({
        lastAllocated: 1,
        reconciliationRequired: true,
      });
    });
    vi.stubEnv("OPERATIONAL_CONTROL_SOURCE_REVISION", "replacement-source-revision");
    await expect(t.run(async (ctx) => nextCode(fromAny(ctx), "queries", "Q"))).rejects.toThrow(
      "CRM code sequence queries:Q requires bounded reconciliation"
    );
    vi.stubEnv("OPERATIONAL_CONTROL_SOURCE_REVISION", TARGET_BINDING.expectedTargetRevision);
    while (inventory.stage === "inventory") {
      inventory = await runInventory(t, {
        limit: 1,
        secret: SECRET,
        tableName: "queries",
      });
    }
    expect(inventory.stage).toBe("ready");
    await expect(t.run(async (ctx) => nextCode(fromAny(ctx), "queries", "Q"))).rejects.toThrow(
      "CRM code sequence queries:Q requires bounded reconciliation"
    );

    await runApply(t, { secret: SECRET, tableName: "queries" });
    await expect(
      t.run(async (ctx) => assertCrmCodeSourceMutationAllowed(fromAny(ctx), "queries"))
    ).resolves.toBeNull();
    await expect(t.run(async (ctx) => nextCode(fromAny(ctx), "queries", "Q"))).resolves.toBe(
      "Q-0004"
    );
  });

  test("preserves an unversioned allocator above the current source maximum", async () => {
    const t = createHarness();
    await seedLegacyQueries(t, 3);
    await t.run(async (ctx) => {
      await ctx.db.insert("crmCodeSequences", {
        key: "queries:Q",
        lastAllocated: 9,
        legacyRowsScanned: 3,
        seededAt: 1,
        updatedAt: 1,
      });
    });

    let inventory = await runInventory(t, {
      limit: 2,
      secret: SECRET,
      tableName: "queries",
    });
    while (inventory.stage === "inventory") {
      inventory = await runInventory(t, {
        limit: 2,
        secret: SECRET,
        tableName: "queries",
      });
    }
    expect(inventory).toMatchObject({ maximumObserved: 9, stage: "ready" });
    await expect(runApply(t, { secret: SECRET, tableName: "queries" })).resolves.toMatchObject({
      sequenceLastAllocated: 9,
      stage: "complete",
    });
    await t.run(async (ctx) => {
      expect(await ctx.db.query("crmCodeSequenceTrust").unique()).toMatchObject({
        lastAllocated: 9,
        reconciliationRequired: false,
      });
    });
    await expect(t.run(async (ctx) => nextCode(fromAny(ctx), "queries", "Q"))).resolves.toBe(
      "Q-0010"
    );
  });

  test("fails inventory for malformed and cross-page duplicate allocations", async () => {
    const t = createHarness();
    await t.run(async (ctx) => {
      for (const [index, queryCode] of ["Q-0001", "Q-0002", "Q-1", "Q-0001", "Q-nope"].entries()) {
        await ctx.db.insert("queries", {
          clientName: `Anomalous sequence client ${index}`,
          contractingStatus: "Query Received",
          createdAt: index + 1,
          createdBy: "migration-fixture",
          paxCount: 1,
          queryCode,
          queryType: "FIT",
          salesStatus: "Proposal in discussion",
          travelType: "Domestic Travel",
          updatedAt: index + 1,
        });
      }
    });

    let inventory = await runInventory(t, {
      limit: 2,
      secret: SECRET,
      tableName: "queries",
    });
    expect(inventory.stage).toBe("inventory");
    while (inventory.stage === "inventory") {
      inventory = await runInventory(t, {
        limit: 2,
        secret: SECRET,
        tableName: "queries",
      });
    }
    expect(inventory).toMatchObject({
      anomalies: 3,
      maximumObserved: 2,
      stage: "ready",
      status: "failed",
    });
    await expect(
      readAnomalies(t, {
        paginationOpts: { cursor: null, numItems: 1 },
        secret: "wrong-secret",
        tableName: "queries",
      })
    ).rejects.toThrow("Invalid migration secret");
    await expect(
      readAnomalies(t, {
        paginationOpts: { cursor: null, numItems: 101 },
        secret: SECRET,
        tableName: "queries",
      })
    ).rejects.toThrow("CRM code sequence anomaly page size must be 1-100");
    const firstAnomalyPage = await readAnomalies(t, {
      paginationOpts: { cursor: null, numItems: 1 },
      secret: SECRET,
      tableName: "queries",
    });
    expect(firstAnomalyPage).toMatchObject(TARGET_RESULT);
    const secondAnomalyPage = await readAnomalies(t, {
      paginationOpts: { cursor: firstAnomalyPage.continueCursor, numItems: 10 },
      secret: SECRET,
      tableName: "queries",
    });
    expect([...firstAnomalyPage.page, ...secondAnomalyPage.page]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ allocation: 1, code: "Q-0001", kind: "duplicate" }),
        expect.objectContaining({ code: "Q-1", kind: "malformed" }),
        expect.objectContaining({ code: "Q-nope", kind: "malformed" }),
      ])
    );
    await expect(runApply(t, { secret: SECRET, tableName: "queries" })).rejects.toThrow(
      "CRM code sequence inventory found malformed or duplicate codes"
    );
    await t.run(async (ctx) => {
      expect(await ctx.db.query("crmCodeSequences").collect()).toEqual([]);
      expect(await ctx.db.query("crmCodeSequenceInventoryAllocations").collect()).toHaveLength(2);
      expect(await ctx.db.query("dataMigrationRegistry").unique()).toMatchObject({
        legacyRemaining: 1,
        quarantined: 3,
        stage: "ready",
        status: "failed",
      });
      const rows = await ctx.db.query("queries").collect();
      const shortCode = rows.find((row) => row.queryCode === "Q-1");
      const malformed = rows.find((row) => row.queryCode === "Q-nope");
      const [, duplicate] = rows.filter((row) => row.queryCode === "Q-0001");
      if (!(shortCode && malformed && duplicate)) {
        throw new Error("Anomalous sequence fixtures are missing");
      }
      await Promise.all([
        ctx.db.patch("queries", shortCode._id, { queryCode: "Q-0003" }),
        ctx.db.patch("queries", malformed._id, { queryCode: "Q-0004" }),
        ctx.db.patch("queries", duplicate._id, { queryCode: "Q-0005" }),
      ]);
    });

    inventory = await runInventory(t, {
      limit: 2,
      secret: SECRET,
      tableName: "queries",
    });
    while (inventory.stage === "inventory" || inventory.stage === "reset") {
      inventory = await runInventory(t, {
        limit: 2,
        secret: SECRET,
        tableName: "queries",
      });
    }
    expect(inventory).toMatchObject({
      anomalies: 0,
      maximumObserved: 5,
      stage: "ready",
      status: "running",
    });
    await expect(runApply(t, { secret: SECRET, tableName: "queries" })).resolves.toMatchObject({
      sequenceLastAllocated: 5,
      stage: "complete",
    });
    await expect(
      readAnomalies(t, {
        paginationOpts: { cursor: null, numItems: 10 },
        secret: SECRET,
        tableName: "queries",
      })
    ).resolves.toMatchObject({ page: [] });
  });

  test("tracks the trusted high-water mark and reinventories rewound or missing allocators", async () => {
    const t = createHarness();
    await seedLegacyQueries(t, 3);
    let inventory = await runInventory(t, {
      limit: 2,
      secret: SECRET,
      tableName: "queries",
    });
    while (inventory.stage === "inventory") {
      inventory = await runInventory(t, {
        limit: 2,
        secret: SECRET,
        tableName: "queries",
      });
    }
    await runApply(t, { secret: SECRET, tableName: "queries" });
    const postMigrationCodes = await Promise.all([
      allocateQuery(t, "Post-migration 4"),
      allocateQuery(t, "Post-migration 5"),
      allocateQuery(t, "Post-migration 6"),
    ]);
    expect([...postMigrationCodes].sort()).toEqual(["Q-0004", "Q-0005", "Q-0006"]);
    await t.run(async (ctx) => {
      const sequence = await ctx.db.query("crmCodeSequences").unique();
      const registry = await ctx.db.query("dataMigrationRegistry").unique();
      if (!sequence) {
        throw new Error("Sequence fixture is missing");
      }
      expect(registry?.checkpoint).toBe(3);
      expect(await ctx.db.query("crmCodeSequenceTrust").unique()).toMatchObject({
        lastAllocated: 6,
        reconciliationRequired: false,
      });
      await ctx.db.patch("crmCodeSequences", sequence._id, { lastAllocated: 4 });
    });

    await expect(t.run(async (ctx) => nextCode(fromAny(ctx), "queries", "Q"))).rejects.toThrow(
      "CRM code sequence queries:Q requires bounded reconciliation"
    );
    await expect(runInventory(t, { secret: SECRET, tableName: "queries" })).resolves.toMatchObject({
      stage: "reset",
      status: "running",
    });
    await expect(runApply(t, { secret: SECRET, tableName: "queries" })).rejects.toThrow(
      "Complete CRM code sequence inventory before apply"
    );
    inventory = await runInventory(t, {
      limit: 2,
      secret: SECRET,
      tableName: "queries",
    });
    while (inventory.stage === "inventory" || inventory.stage === "reset") {
      inventory = await runInventory(t, {
        limit: 2,
        secret: SECRET,
        tableName: "queries",
      });
    }
    expect(inventory).toMatchObject({ maximumObserved: 6, stage: "ready" });
    await runApply(t, { secret: SECRET, tableName: "queries" });
    await expect(allocateQuery(t, "Post-rewind 7")).resolves.toBe("Q-0007");

    await t.run(async (ctx) => {
      const sequence = await ctx.db.query("crmCodeSequences").unique();
      const highestSource = await ctx.db
        .query("queries")
        .withIndex("by_queryCode", (q) => q.eq("queryCode", "Q-0007"))
        .unique();
      const registry = await ctx.db.query("dataMigrationRegistry").unique();
      if (!(sequence && highestSource)) {
        throw new Error("Highest sequence fixtures are missing after rewind repair");
      }
      expect(registry?.checkpoint).toBe(6);
      expect(await ctx.db.query("crmCodeSequenceTrust").unique()).toMatchObject({
        lastAllocated: 7,
        reconciliationRequired: false,
      });
      await Promise.all([
        ctx.db.delete("crmCodeSequences", sequence._id),
        ctx.db.delete("queries", highestSource._id),
      ]);
    });
    vi.stubEnv("OPERATIONAL_CONTROL_SOURCE_REVISION", "post-loss-source-revision");
    await expect(t.run(async (ctx) => nextCode(fromAny(ctx), "queries", "Q"))).rejects.toThrow(
      "CRM code sequence queries:Q requires bounded reconciliation"
    );
    vi.stubEnv("OPERATIONAL_CONTROL_SOURCE_REVISION", TARGET_BINDING.expectedTargetRevision);
    await expect(runInventory(t, { secret: SECRET, tableName: "queries" })).resolves.toMatchObject({
      stage: "reset",
      status: "running",
    });
    inventory = await runInventory(t, {
      limit: 2,
      secret: SECRET,
      tableName: "queries",
    });
    while (inventory.stage === "inventory" || inventory.stage === "reset") {
      inventory = await runInventory(t, {
        limit: 2,
        secret: SECRET,
        tableName: "queries",
      });
    }
    expect(inventory).toMatchObject({ maximumObserved: 7, stage: "ready" });
    await runApply(t, { secret: SECRET, tableName: "queries" });
    await expect(t.run(async (ctx) => nextCode(fromAny(ctx), "queries", "Q"))).resolves.toBe(
      "Q-0008"
    );
  });
});
