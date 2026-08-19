import { describe, expect, spyOn, test } from "bun:test";
import { ConvexError } from "convex/values";
import type { RuntimeObject, RuntimeValue } from "../lib/runtimeValues";
import type { TestIndexQuery } from "../testSupport/runtimeContracts";
import type { PortalAccess } from "./lib";
import { applyQueryTeamAssignments } from "./queryTeamAssignment";

const lib = await import("./lib");

interface Row {
  _id: string;
  [key: string]: RuntimeValue;
}
type Tables = Record<string, Row[]>;

function headAccess(overrides: Partial<PortalAccess> = {}): PortalAccess {
  return {
    allowed: true,
    authUserId: "auth_head",
    email: "head@citiusholidays.com",
    name: "Ops Head",
    permissions: [],
    roles: ["Operations Head"],
    ...overrides,
  };
}

function salesAccess(overrides: Partial<PortalAccess> = {}): PortalAccess {
  return {
    allowed: true,
    authUserId: "auth_sales",
    email: "sales@citiusholidays.com",
    name: "Sales User",
    permissions: ["manage:queries"],
    roles: ["Sales"],
    staffId: "staffUsers_sales",
    ...overrides,
  };
}

function makeAssignmentCtx(initialTables: Tables) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))])
  );

  const ctx = {
    db: {
      get: (_table: string, id: string) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((entry) => entry._id === id);
          if (row) {
            return row;
          }
        }
        return null;
      },
      insert: (tableName: string, doc: RuntimeObject) => {
        const id = `${tableName}_${(tables[tableName]?.length ?? 0) + 1}`;
        const row = { _id: id, ...doc };
        tables[tableName] = [...(tables[tableName] ?? []), row];
        return id;
      },
      normalizeId(_table: string, id: string) {
        return id;
      },
      patch: (_table: string, id: string, patch: RuntimeObject) => {
        for (const [table, rows] of Object.entries(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            tables[table][index] = { ...rows[index], ...patch };
            return;
          }
        }
      },
      query(tableName: string) {
        let rows = tables[tableName] ?? [];
        return {
          collect: async () => [...rows],
          withIndex(_indexName: string, callback: (q: TestIndexQuery) => TestIndexQuery) {
            const filters: Array<{ field: string; value: RuntimeValue }> = [];
            const q: TestIndexQuery = {
              eq(field: string, value: RuntimeValue) {
                filters.push({ field, value });
                return q;
              },
            };
            callback(q);
            rows = rows.filter((row) =>
              filters.every((filter) => row[filter.field] === filter.value)
            );
            return this;
          },
        };
      },
    },
    scheduler: {
      runAfter: async () => undefined,
    },
  };

  return { ctx, tables };
}

const baseQuery = {
  _id: "queries_1",
  queryCode: "Q-0001",
  queryType: "FIT",
  salesOwnerName: "Sales User",
};

const contractingStaff = {
  _id: "staffUsers_contracting",
  active: true,
  name: " Contracting User ",
  roles: ["Contracting"],
};

const ticketingStaff = {
  _id: "staffUsers_ticketing",
  active: true,
  name: "Ticketing User",
  roles: ["Ticketing"],
};

describe("ApplyQueryTeamAssignments", () => {
  test("Allows Sales to make the initial contracting assignment with ticketing scope", async () => {
    const { ctx, tables } = makeAssignmentCtx({
      contractingAssignments: [],
      jobCards: [],
      queries: [{ ...baseQuery, salesOwnerId: "auth_sales" }],
      staffUsers: [contractingStaff],
    });
    const createActivity = spyOn(lib, "createActivity").mockImplementation(() => Promise.resolve());
    const publishWorkflowNotification = spyOn(
      lib,
      "publishWorkflowNotification"
    ).mockImplementation(() => Promise.resolve());

    try {
      // SAFETY: This test controls the asserted value at the framework boundary below.
      await applyQueryTeamAssignments(ctx as never, salesAccess(), {
        contractingStaffId: "staffUsers_contracting",
        queryId: "queries_1",
        ticketingScope: "Both",
      });

      expect(tables.queries[0]).toMatchObject({
        contractingOwnerId: "staffUsers_contracting",
        contractingOwnerName: "Contracting User",
        contractingStatus: "Query Received",
        ticketingScope: "Both",
      });
      expect(publishWorkflowNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          bellTargets: { kind: "staff", staffIds: ["staffUsers_contracting"] },
          content: expect.objectContaining({ title: "Assign contracting owner" }),
        })
      );
      expect(publishWorkflowNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          bellTargets: {
            kind: "roles",
            roles: ["Contracting Head", "Operations Head", "Head of Ticketing"],
          },
          content: expect.objectContaining({ title: "Assign Ticketing SPOC" }),
          emailTargets: { kind: "roles", roles: ["Head of Ticketing"] },
        })
      );
    } finally {
      createActivity.mockRestore();
      publishWorkflowNotification.mockRestore();
    }
  });

  test("Assigns contracting and ticketing in one write", async () => {
    const { ctx, tables } = makeAssignmentCtx({
      contractingAssignments: [],
      jobCards: [{ _id: "jobCards_1", queryId: "queries_1" }],
      queries: [{ ...baseQuery }],
      staffUsers: [contractingStaff, ticketingStaff],
    });
    const createActivity = spyOn(lib, "createActivity").mockImplementation(() => Promise.resolve());
    const publishWorkflowNotification = spyOn(
      lib,
      "publishWorkflowNotification"
    ).mockImplementation(() => Promise.resolve());

    try {
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const result = await applyQueryTeamAssignments(ctx as never, headAccess(), {
        contractingStaffId: "staffUsers_contracting",
        queryId: "queries_1",
        ticketingScope: "International",
        ticketingStaffId: "staffUsers_ticketing",
      });

      expect(result.id).toBe("queries_1");
      expect(tables.queries[0]).toMatchObject({
        contractingOwnerId: "staffUsers_contracting",
        contractingOwnerName: "Contracting User",
        contractingStatus: "Query Received",
        ticketingOwnerId: "staffUsers_ticketing",
        ticketingOwnerName: "Ticketing User",
        ticketingScope: "International",
      });
      expect(tables.jobCards[0]).toMatchObject({
        contractingOwnerId: "staffUsers_contracting",
        ticketingOwnerId: "staffUsers_ticketing",
      });
      expect(tables.contractingAssignments).toHaveLength(1);
      expect(createActivity).toHaveBeenCalledTimes(2);
      expect(publishWorkflowNotification).toHaveBeenCalledTimes(3);
    } finally {
      createActivity.mockRestore();
      publishWorkflowNotification.mockRestore();
    }
  });

  test("Supports contracting-only assignment", async () => {
    const { ctx, tables } = makeAssignmentCtx({
      contractingAssignments: [],
      jobCards: [],
      queries: [{ ...baseQuery }],
      staffUsers: [contractingStaff],
    });
    const createActivity = spyOn(lib, "createActivity").mockImplementation(() => Promise.resolve());
    const publishWorkflowNotification = spyOn(
      lib,
      "publishWorkflowNotification"
    ).mockImplementation(() => Promise.resolve());

    try {
      // SAFETY: This test controls the asserted value at the framework boundary below.
      await applyQueryTeamAssignments(ctx as never, headAccess(), {
        contractingStaffId: "staffUsers_contracting",
        queryId: "queries_1",
      });

      expect(tables.queries[0]?.contractingOwnerId).toBe("staffUsers_contracting");
      expect(tables.queries[0]).not.toHaveProperty("ticketingOwnerId");
      expect(tables.contractingAssignments).toHaveLength(1);
      expect(createActivity).toHaveBeenCalledTimes(1);
      expect(publishWorkflowNotification).toHaveBeenCalledTimes(2);
    } finally {
      createActivity.mockRestore();
      publishWorkflowNotification.mockRestore();
    }
  });

  test("Notifies only contracting and operations heads when ticketing is not required", async () => {
    const { ctx } = makeAssignmentCtx({
      contractingAssignments: [],
      jobCards: [],
      queries: [{ ...baseQuery, salesOwnerId: "auth_sales" }],
      staffUsers: [contractingStaff],
    });
    const createActivity = spyOn(lib, "createActivity").mockImplementation(() => Promise.resolve());
    const publishWorkflowNotification = spyOn(
      lib,
      "publishWorkflowNotification"
    ).mockImplementation(() => Promise.resolve());

    try {
      // SAFETY: This test controls the asserted value at the framework boundary below.
      await applyQueryTeamAssignments(ctx as never, salesAccess(), {
        contractingStaffId: "staffUsers_contracting",
        queryId: "queries_1",
        ticketingScope: "Not required",
      });

      expect(publishWorkflowNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          bellTargets: {
            kind: "roles",
            roles: ["Contracting Head", "Operations Head"],
          },
          content: expect.objectContaining({ title: "Query team assigned by Sales" }),
          emailTargets: { kind: "none" },
        })
      );
    } finally {
      createActivity.mockRestore();
      publishWorkflowNotification.mockRestore();
    }
  });

  test("Prevents Sales from reassigning after initial assignment", async () => {
    const { ctx } = makeAssignmentCtx({
      contractingAssignments: [],
      jobCards: [],
      queries: [
        {
          ...baseQuery,
          contractingOwnerId: "staffUsers_existing",
          salesOwnerId: "auth_sales",
          submittedToContractingAt: Date.now(),
          ticketingScope: "Domestic",
        },
      ],
      staffUsers: [contractingStaff],
    });

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      applyQueryTeamAssignments(ctx as never, salesAccess(), {
        contractingStaffId: "staffUsers_contracting",
        queryId: "queries_1",
        ticketingScope: "Both",
      })
    ).rejects.toEqual(new ConvexError("Only heads can reassign query teams."));
  });

  test("Allows Sales to make the first assignment after query submission when no team fields exist", async () => {
    const { ctx, tables } = makeAssignmentCtx({
      contractingAssignments: [],
      jobCards: [],
      queries: [
        {
          ...baseQuery,
          salesOwnerId: "auth_sales",
          submittedToContractingAt: Date.now(),
        },
      ],
      staffUsers: [contractingStaff],
    });
    const createActivity = spyOn(lib, "createActivity").mockImplementation(() => Promise.resolve());
    const publishWorkflowNotification = spyOn(
      lib,
      "publishWorkflowNotification"
    ).mockImplementation(() => Promise.resolve());

    try {
      // SAFETY: This test controls the asserted value at the framework boundary below.
      await applyQueryTeamAssignments(ctx as never, salesAccess(), {
        contractingStaffId: "staffUsers_contracting",
        queryId: "queries_1",
        ticketingScope: "Domestic",
      });

      expect(tables.queries[0]).toMatchObject({
        contractingOwnerId: "staffUsers_contracting",
        ticketingScope: "Domestic",
      });
      expect(publishWorkflowNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          bellTargets: { kind: "staff", staffIds: ["staffUsers_contracting"] },
          content: expect.objectContaining({ title: "Assign contracting owner" }),
        })
      );
    } finally {
      createActivity.mockRestore();
      publishWorkflowNotification.mockRestore();
    }
  });

  test("Rejects invalid ticketing scope", async () => {
    const { ctx } = makeAssignmentCtx({
      contractingAssignments: [],
      jobCards: [],
      queries: [{ ...baseQuery, salesOwnerId: "auth_sales" }],
      staffUsers: [contractingStaff],
    });

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      applyQueryTeamAssignments(ctx as never, salesAccess(), {
        contractingStaffId: "staffUsers_contracting",
        queryId: "queries_1",
        ticketingScope: "Regional",
      })
    ).rejects.toEqual(new ConvexError("Select a valid Ticketing Scope."));
  });

  test("Supports ticketing-only assignment", async () => {
    const { ctx, tables } = makeAssignmentCtx({
      jobCards: [],
      queries: [{ ...baseQuery }],
      staffUsers: [ticketingStaff],
    });
    const createActivity = spyOn(lib, "createActivity").mockImplementation(() => Promise.resolve());
    const publishWorkflowNotification = spyOn(
      lib,
      "publishWorkflowNotification"
    ).mockImplementation(() => Promise.resolve());

    try {
      // SAFETY: This test controls the asserted value at the framework boundary below.
      await applyQueryTeamAssignments(ctx as never, headAccess(), {
        queryId: "queries_1",
        ticketingStaffId: "staffUsers_ticketing",
      });

      expect(tables.queries[0]?.ticketingOwnerId).toBe("staffUsers_ticketing");
      expect(tables.queries[0]).not.toHaveProperty("contractingOwnerId");
      expect(tables.contractingAssignments ?? []).toHaveLength(0);
      expect(createActivity).toHaveBeenCalledTimes(1);
      expect(publishWorkflowNotification).toHaveBeenCalledTimes(2);
    } finally {
      createActivity.mockRestore();
      publishWorkflowNotification.mockRestore();
    }
  });

  test("Does not partially commit when the second assignee is invalid", async () => {
    const { ctx, tables } = makeAssignmentCtx({
      contractingAssignments: [],
      jobCards: [],
      queries: [{ ...baseQuery }],
      staffUsers: [
        contractingStaff,
        { _id: "staffUsers_sales", active: true, name: "Sales User", roles: ["Sales"] },
      ],
    });

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      applyQueryTeamAssignments(ctx as never, headAccess(), {
        contractingStaffId: "staffUsers_contracting",
        queryId: "queries_1",
        ticketingStaffId: "staffUsers_sales",
      })
    ).rejects.toThrow("Selected staff member is not on the ticketing team");

    expect(tables.queries[0]).not.toHaveProperty("contractingOwnerId");
    expect(tables.contractingAssignments).toHaveLength(0);
  });

  test("Rejects queries the caller cannot see", async () => {
    const { ctx } = makeAssignmentCtx({
      queries: [{ ...baseQuery }],
      staffUsers: [contractingStaff],
    });

    await expect(
      applyQueryTeamAssignments(
        // SAFETY: This test controls the asserted value at the framework boundary below.
        ctx as never,
        headAccess({ roles: ["Ticketing"], staffId: "staffUsers_other" }),
        {
          contractingStaffId: "staffUsers_contracting",
          queryId: "queries_1",
        }
      )
    ).rejects.toEqual(new ConvexError("FORBIDDEN"));
  });

  test("Requires at least one assignee", async () => {
    const { ctx } = makeAssignmentCtx({
      queries: [{ ...baseQuery }],
      staffUsers: [contractingStaff],
    });

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      applyQueryTeamAssignments(ctx as never, headAccess(), { queryId: "queries_1" })
    ).rejects.toEqual(new ConvexError("Select a contracting and/or ticketing SPOC."));
  });
});
