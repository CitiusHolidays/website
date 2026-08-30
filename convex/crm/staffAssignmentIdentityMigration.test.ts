import { afterEach, describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import type { RuntimeObject, RuntimeValue } from "../lib/runtimeValues";
import type { TestIndexQuery } from "../testSupport/runtimeContracts";
import {
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

const previousSecret = process.env.MIGRATION_SECRET;

afterEach(() => {
  if (previousSecret === undefined) {
    delete process.env.MIGRATION_SECRET;
  } else {
    process.env.MIGRATION_SECRET = previousSecret;
  }
});

describe("Staff assignment identity inventory", () => {
  test("Dry-run classifies every assignment and queues only ambiguity or unresolved rows", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx, tables } = makeCtx();
    const originalQueries = structuredClone(tables.queries);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await fromAny<any, unknown>(runStaffAssignmentIdentityDryRunPage)._handler(ctx, {
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
    const failed = await fromAny<any, unknown>(verifyStaffAssignmentIdentityResidualsPage)._handler(
      ctx,
      {
        secret: "local-test-secret",
        source: "queries",
      }
    );
    expect(failed).toMatchObject({ legacyRemaining: 4, status: "failed" });

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

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const verified = await fromAny<any, unknown>(
      verifyStaffAssignmentIdentityResidualsPage
    )._handler(ctx, {
      restart: true,
      secret: "local-test-secret",
      source: "queries",
    });
    expect(verified).toMatchObject({ legacyRemaining: 0, status: "verified" });
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
        secret: "wrong-secret",
        source: "queries",
      })
    ).rejects.toThrow("Invalid migration secret");
  });
});
