import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import type { RuntimeObject, RuntimeValue } from "../lib/runtimeValues";
import type { TestIndexQuery } from "../testSupport/runtimeContracts";
import {
  applyStaffAssignmentIdentityPage,
  listStaffAssignmentIdentityAmbiguities,
  runStaffAssignmentIdentityDryRunPage,
  verifyStaffAssignmentIdentityResidualsPage,
} from "./staffAssignmentIdentityMigration";

interface Row {
  _id: string;
  [field: string]: RuntimeValue;
}

function makeCtx() {
  const tables = {
    dataMigrationRegistry: [],
    jobCards: [
      {
        _id: "job_tour_manager",
        jobCode: "JC-TOUR-MANAGER",
        tourManagerId: "tour_manager_assignment",
        tourManagerName: "Stale Tour Manager Label",
      },
    ],
    proposalQueryLinks: [
      {
        _id: "proposal_link_legacy",
        proposalId: "proposal_legacy",
        queryId: "query_unique_name",
        salesOwnerName: "Unique Sales",
      },
    ],
    proposals: [
      {
        _id: "proposal_legacy",
        preparedBy: "Unique Sales",
        proposalCode: "P-LEGACY",
      },
    ],
    queries: [
      {
        _id: "query_canonical",
        queryCode: "Q-CANONICAL",
        salesOwnerId: "staff_sales_canonical",
        salesOwnerName: "Historical Sales Label",
      },
      {
        _id: "query_unique_name",
        queryCode: "Q-UNIQUE",
        salesOwnerName: "Unique Sales",
      },
      {
        _id: "query_ambiguous",
        queryCode: "Q-AMBIGUOUS",
        ticketingOwnerName: "Shared Ticketing",
      },
      {
        _id: "query_unresolved",
        contractingOwnerName: "Missing Contracting",
        queryCode: "Q-UNRESOLVED",
      },
      {
        _id: "query_conflicting_label",
        contractingOwnerId: "staff_contracting_canonical",
        contractingOwnerName: "Unique Sales",
        queryCode: "Q-CONFLICTING-LABEL",
      },
      {
        _id: "query_legacy_auth",
        queryCode: "Q-LEGACY-AUTH",
        salesOwnerId: "legacy-sales-subject",
        salesOwnerName: "Legacy Auth Sales",
      },
    ],
    staffAssignmentIdentityQuarantines: [],
    staffUsers: [
      {
        _id: "staff_sales_canonical",
        active: true,
        authUserId: "issuer|canonical-sales",
        name: "Canonical Sales",
        roles: ["Sales"],
      },
      {
        _id: "staff_sales_unique",
        active: true,
        authUserId: "issuer|unique-sales",
        name: "Unique Sales",
        roles: ["Sales"],
      },
      {
        _id: "staff_ticketing_a",
        active: true,
        name: "Shared Ticketing",
        roles: ["Ticketing"],
      },
      {
        _id: "staff_ticketing_b",
        active: true,
        name: "Shared Ticketing",
        roles: ["Head of Ticketing"],
      },
      {
        _id: "staff_contracting_canonical",
        active: true,
        name: "Different Contracting Owner",
        roles: ["Contracting"],
      },
      {
        _id: "staff_sales_legacy_auth",
        active: true,
        authUserId: "legacy-sales-subject",
        name: "Legacy Auth Sales",
        roles: ["Sales"],
      },
      {
        _id: "staff_tour_manager",
        active: true,
        name: "Canonical Tour Manager",
        roles: ["Tour Manager"],
      },
    ],
    tourManagerAssignments: [
      {
        _id: "tour_manager_assignment",
        staffId: "staff_tour_manager",
      },
    ],
    travelBatches: [
      {
        _id: "batch_canonical",
        batchReference: "JC-TOUR-MANAGER / B01",
        tourManagerName: "Conflicting Legacy Label",
        tourManagerStaffId: "staff_tour_manager",
      },
    ],
  } satisfies Record<string, Row[]>;
  let nextId = 1;
  const rows = (table: string): Row[] =>
    Object.entries(tables).find(([name]) => name === table)?.[1] ?? [];
  const query = (table: string) => {
    let selected = [...rows(table)];
    const builder = {
      order: () => builder,
      paginate: ({ cursor, numItems }: { cursor: string | null; numItems: number }) => {
        const start = cursor ? Number(cursor) : 0;
        const page = selected.slice(start, start + numItems).map((row) => ({ ...row }));
        const end = start + page.length;
        return {
          continueCursor: String(end),
          isDone: end >= selected.length,
          page,
        };
      },
      take: async (limit: number) => selected.slice(0, limit),
      unique: async () => selected[0] ?? null,
      withIndex: (_indexName: string, callback: (range: TestIndexQuery) => TestIndexQuery) => {
        const filters: [string, RuntimeValue][] = [];
        const range: TestIndexQuery = {
          eq: (field: string, value: RuntimeValue) => {
            filters.push([field, value]);
            return range;
          },
        };
        callback(range);
        selected = selected.filter((row) =>
          filters.every(([field, value]) => row[field] === value)
        );
        return builder;
      },
    };
    return builder;
  };
  const db = {
    delete: (table: string, id: string) => {
      const tableRows = rows(table);
      const index = tableRows.findIndex((row) => row._id === id);
      if (index >= 0) {
        tableRows.splice(index, 1);
      }
    },
    get: async (table: string, id: string) => rows(table).find((row) => row._id === id) ?? null,
    insert: (table: string, value: RuntimeObject) => {
      const id = `${table}_${nextId}`;
      nextId += 1;
      rows(table).push({ _id: id, ...value });
      return id;
    },
    normalizeId: (table: string, id: string) =>
      rows(table).some((row) => row._id === id) ? id : null,
    patch: (table: string, id: string, value: RuntimeObject) => {
      const row = rows(table).find((candidate) => candidate._id === id);
      if (row) {
        Object.assign(row, value);
      }
    },
    query,
  };
  return { ctx: { db }, tables };
}

const TARGET_IDENTITY = {
  targetDeployment: "development:test",
  targetEnvironment: "development" as const,
  targetRevision: "test-revision",
};
const MIGRATION_TARGET = {
  expectedTargetDeployment: TARGET_IDENTITY.targetDeployment,
  expectedTargetEnvironment: TARGET_IDENTITY.targetEnvironment,
  expectedTargetRevision: TARGET_IDENTITY.targetRevision,
} as const;

const previousEnvironment = {
  deployment: process.env.OPERATIONAL_CONTROL_TARGET_ID,
  environment: process.env.VERCEL_ENV,
  revision: process.env.OPERATIONAL_CONTROL_SOURCE_REVISION,
  secret: process.env.MIGRATION_SECRET,
};

function restore(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

beforeEach(() => {
  process.env.OPERATIONAL_CONTROL_TARGET_ID = TARGET_IDENTITY.targetDeployment;
  process.env.VERCEL_ENV = TARGET_IDENTITY.targetEnvironment;
  process.env.OPERATIONAL_CONTROL_SOURCE_REVISION = TARGET_IDENTITY.targetRevision;
});

afterEach(() => {
  restore("MIGRATION_SECRET", previousEnvironment.secret);
  restore("OPERATIONAL_CONTROL_TARGET_ID", previousEnvironment.deployment);
  restore("VERCEL_ENV", previousEnvironment.environment);
  restore("OPERATIONAL_CONTROL_SOURCE_REVISION", previousEnvironment.revision);
});

describe("Staff assignment identity inventory", () => {
  test("Dry-run classifies every assignment and queues only ambiguity or unresolved rows", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx, tables } = makeCtx();
    const originalQueries = structuredClone(tables.queries);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await fromAny<any, unknown>(runStaffAssignmentIdentityDryRunPage)._handler(ctx, {
      ...MIGRATION_TARGET,
      limit: 25,
      secret: "local-test-secret",
      source: "queries",
    });

    expect(result).toMatchObject({
      ambiguous: 1,
      canonical: 2,
      legacyRemaining: 4,
      resolvable: 2,
      status: "failed",
      unresolved: 1,
    });
    expect(tables.queries).toEqual(originalQueries);
    expect(tables.staffAssignmentIdentityQuarantines).toHaveLength(2);
    expect(
      tables.staffAssignmentIdentityQuarantines.map((row) => [row.recordId, row.disposition])
    ).toEqual([
      ["query_ambiguous", "ambiguous"],
      ["query_unresolved", "unresolved"],
    ]);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const queue = await fromAny<any, unknown>(listStaffAssignmentIdentityAmbiguities)._handler(
      ctx,
      {
        ...MIGRATION_TARGET,
        cursor: null,
        secret: "local-test-secret",
        source: "queries",
      }
    );
    expect(queue.isDone).toBe(true);
    expect(queue.page).toHaveLength(2);
    expect(queue.page[0]).not.toHaveProperty("email");
  });

  test("Independent verifier requires zero residual assignments", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx, tables } = makeCtx();
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const verify = fromAny<any, unknown>(verifyStaffAssignmentIdentityResidualsPage)._handler;

    const reset = await verify(ctx, {
      ...MIGRATION_TARGET,
      secret: "local-test-secret",
      source: "queries",
    });
    expect(reset).toMatchObject({ stage: "verify", status: "running" });
    const failed = await verify(ctx, {
      ...MIGRATION_TARGET,
      secret: "local-test-secret",
      source: "queries",
    });
    expect(failed).toMatchObject({ legacyRemaining: 4, status: "failed" });
    expect(tables.staffAssignmentIdentityQuarantines).toHaveLength(2);

    Object.assign(tables.queries[1], {
      salesOwnerId: "staff_sales_unique",
    });
    Object.assign(tables.queries[2], {
      ticketingOwnerId: "staff_ticketing_a",
    });
    Object.assign(tables.queries[3], {
      contractingOwnerId: "staff_contracting_canonical",
    });
    Object.assign(tables.queries[5], {
      salesOwnerId: "staff_sales_legacy_auth",
    });

    const restarted = await verify(ctx, {
      ...MIGRATION_TARGET,
      restart: true,
      secret: "local-test-secret",
      source: "queries",
    });
    expect(restarted).toMatchObject({ stage: "verify", status: "running" });
    expect(tables.staffAssignmentIdentityQuarantines).toHaveLength(0);
    const verified = await verify(ctx, {
      ...MIGRATION_TARGET,
      secret: "local-test-secret",
      source: "queries",
    });
    expect(verified).toMatchObject({ legacyRemaining: 0, status: "verified" });
    expect(tables.staffAssignmentIdentityQuarantines).toHaveLength(0);
  });

  test("Apply lane patches only deterministic assignments and remains idempotent", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx, tables } = makeCtx();
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const apply = fromAny<any, unknown>(applyStaffAssignmentIdentityPage)._handler;

    const proposals = await apply(ctx, {
      ...MIGRATION_TARGET,
      secret: "local-test-secret",
      source: "proposals",
    });
    expect(proposals).toMatchObject({ applied: 1, legacyRemaining: 0, status: "verified" });
    expect(tables.proposals[0].preparedByStaffId).toBe("staff_sales_unique");

    const repeated = await apply(ctx, {
      ...MIGRATION_TARGET,
      secret: "local-test-secret",
      source: "proposals",
    });
    expect(repeated).toMatchObject({ applied: 0, legacyRemaining: 0, status: "verified" });

    const queries = await apply(ctx, {
      ...MIGRATION_TARGET,
      secret: "local-test-secret",
      source: "queries",
    });
    expect(queries).toMatchObject({
      ambiguous: 1,
      applied: 2,
      legacyRemaining: 2,
      status: "failed",
      unresolved: 1,
    });
    expect(tables.queries[1].salesOwnerId).toBe("staff_sales_unique");
    expect(tables.queries[5].salesOwnerId).toBe("staff_sales_legacy_auth");
    expect(tables.queries[2]).not.toHaveProperty("ticketingOwnerId");
    expect(tables.queries[3]).not.toHaveProperty("contractingOwnerId");
    expect(tables.staffAssignmentIdentityQuarantines).toHaveLength(2);
  });

  test("Rejects a valid apply secret for the wrong target before writing", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx, tables } = makeCtx();
    const original = structuredClone(tables);

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(applyStaffAssignmentIdentityPage)._handler(ctx, {
        ...MIGRATION_TARGET,
        expectedTargetDeployment: "development:other",
        secret: "local-test-secret",
        source: "proposals",
      })
    ).rejects.toThrow("OPERATIONAL_CONTROL_TARGET_MISMATCH");
    expect(tables).toEqual(original);
  });

  test("Keeps registries and ambiguity reads isolated across source revisions", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx, tables } = makeCtx();
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const dryRun = fromAny<any, unknown>(runStaffAssignmentIdentityDryRunPage)._handler;
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const list = fromAny<any, unknown>(listStaffAssignmentIdentityAmbiguities)._handler;

    await dryRun(ctx, {
      ...MIGRATION_TARGET,
      limit: 25,
      secret: "local-test-secret",
      source: "queries",
    });
    process.env.OPERATIONAL_CONTROL_SOURCE_REVISION = "next-revision";
    const nextTarget = { ...MIGRATION_TARGET, expectedTargetRevision: "next-revision" };

    const beforeInventory = await list(ctx, {
      ...nextTarget,
      cursor: null,
      secret: "local-test-secret",
      source: "queries",
    });
    expect(beforeInventory).toMatchObject({ page: [], targetRevision: "next-revision" });

    await dryRun(ctx, {
      ...nextTarget,
      limit: 25,
      secret: "local-test-secret",
      source: "queries",
    });
    const nextQueue = await list(ctx, {
      ...nextTarget,
      cursor: null,
      secret: "local-test-secret",
      source: "queries",
    });
    expect(nextQueue.page).toHaveLength(2);
    expect(tables.staffAssignmentIdentityQuarantines).toHaveLength(4);
    expect(tables.dataMigrationRegistry).toHaveLength(2);
    expect(new Set(tables.dataMigrationRegistry.map((row) => row.key)).size).toBe(2);
  });

  test("Dry-run restart and apply clear stale queue rows after source assignments disappear", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx, tables } = makeCtx();

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const dryRun = fromAny<any, unknown>(runStaffAssignmentIdentityDryRunPage)._handler;
    await dryRun(ctx, {
      ...MIGRATION_TARGET,
      limit: 25,
      secret: "local-test-secret",
      source: "queries",
    });
    expect(tables.staffAssignmentIdentityQuarantines).toHaveLength(2);
    const staleQueue = structuredClone(tables.staffAssignmentIdentityQuarantines);

    const ambiguousIndex = tables.queries.findIndex((row) => row._id === "query_ambiguous");
    tables.queries.splice(ambiguousIndex, 1);
    const unresolved = tables.queries.find((row) => row._id === "query_unresolved");
    if (!unresolved) {
      throw new Error("Missing unresolved query fixture");
    }
    unresolved.contractingOwnerName = undefined;
    const unique = tables.queries.find((row) => row._id === "query_unique_name");
    const legacyAuth = tables.queries.find((row) => row._id === "query_legacy_auth");
    if (!(unique && legacyAuth)) {
      throw new Error("Missing resolvable query fixtures");
    }
    unique.salesOwnerId = "staff_sales_unique";
    legacyAuth.salesOwnerId = "staff_sales_legacy_auth";

    const restartedDryRun = await dryRun(ctx, {
      ...MIGRATION_TARGET,
      limit: 25,
      restart: true,
      secret: "local-test-secret",
      source: "queries",
    });
    expect(restartedDryRun).toMatchObject({ legacyRemaining: 0, status: "verified" });
    expect(tables.staffAssignmentIdentityQuarantines).toHaveLength(0);

    unique.salesOwnerId = undefined;
    legacyAuth.salesOwnerId = "legacy-sales-subject";
    tables.staffAssignmentIdentityQuarantines.push(...staleQueue);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const applied = await fromAny<any, unknown>(applyStaffAssignmentIdentityPage)._handler(ctx, {
      ...MIGRATION_TARGET,
      limit: 25,
      secret: "local-test-secret",
      source: "queries",
    });
    expect(applied).toMatchObject({
      applied: 2,
      legacyRemaining: 0,
      status: "verified",
    });
    expect(tables.staffAssignmentIdentityQuarantines).toHaveLength(0);
  });

  test("Classifies Proposal links, Job Cards, and Travel Batch assignment seams", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx } = makeCtx();

    const cases = [
      ["proposals", { canonical: 0, legacyRemaining: 1, resolvable: 1, status: "failed" }],
      ["proposalQueryLinks", { canonical: 0, legacyRemaining: 1, resolvable: 1, status: "failed" }],
      ["jobCards", { canonical: 0, legacyRemaining: 1, resolvable: 1, status: "failed" }],
      ["travelBatches", { canonical: 1, legacyRemaining: 0, resolvable: 0, status: "verified" }],
    ] as const;
    const results = await Promise.all(
      cases.map(([source]) =>
        // SAFETY: This test controls the asserted value at the framework boundary below.
        fromAny<any, unknown>(runStaffAssignmentIdentityDryRunPage)._handler(ctx, {
          ...MIGRATION_TARGET,
          limit: 25,
          secret: "local-test-secret",
          source,
        })
      )
    );

    results.forEach((result, index) => {
      expect(result).toMatchObject(cases[index][1]);
    });
  });

  test("Rejects callers without the migration capability", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx } = makeCtx();

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(runStaffAssignmentIdentityDryRunPage)._handler(ctx, {
        ...MIGRATION_TARGET,
        secret: "wrong-secret",
        source: "queries",
      })
    ).rejects.toThrow("Invalid migration secret");
  });
});
