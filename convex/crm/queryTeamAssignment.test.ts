import { describe, expect, spyOn, test } from "bun:test";
import { ConvexError } from "convex/values";
import type { PortalAccess } from "./lib";
import * as lib from "./lib";
import { applyQueryTeamAssignments } from "./queryTeamAssignment";

type Row = { _id: string; [key: string]: unknown };
type Tables = Record<string, Row[]>;

function headAccess(overrides: Partial<PortalAccess> = {}): PortalAccess {
  return {
    allowed: true,
    email: "head@citiusholidays.com",
    name: "Ops Head",
    roles: ["Operations Head"],
    permissions: [],
    authUserId: "auth_head",
    ...overrides,
  };
}

function salesAccess(overrides: Partial<PortalAccess> = {}): PortalAccess {
  return {
    allowed: true,
    email: "sales@citiusholidays.com",
    name: "Sales User",
    roles: ["Sales"],
    permissions: ["manage:queries"],
    authUserId: "auth_sales",
    staffId: "staffUsers_sales",
    ...overrides,
  };
}

function makeAssignmentCtx(initialTables: Tables) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))]),
  ) as Tables;

  const ctx = {
    db: {
      normalizeId(_table: string, id: string) {
        return id;
      },
      get: async (id: string) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((entry) => entry._id === id);
          if (row) {
            return row;
          }
        }
        return null;
      },
      query(tableName: string) {
        let rows = tables[tableName] ?? [];
        return {
          withIndex(_indexName: string, callback: (q: unknown) => unknown) {
            const filters: Array<{ field: string; value: unknown }> = [];
            const q = {
              eq(field: string, value: unknown) {
                filters.push({ field, value });
                return q;
              },
            };
            callback(q);
            rows = rows.filter((row) =>
              filters.every((filter) => row[filter.field] === filter.value),
            );
            return this;
          },
          collect: async () => [...rows],
        };
      },
      patch: async (id: string, patch: Record<string, unknown>) => {
        for (const [table, rows] of Object.entries(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            tables[table][index] = { ...rows[index], ...patch };
            return;
          }
        }
      },
      insert: async (tableName: string, doc: Record<string, unknown>) => {
        const id = `${tableName}_${(tables[tableName]?.length ?? 0) + 1}`;
        const row = { _id: id, ...doc };
        tables[tableName] = [...(tables[tableName] ?? []), row];
        return id;
      },
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
  name: " Contracting User ",
  active: true,
  roles: ["Contracting"],
};

const ticketingStaff = {
  _id: "staffUsers_ticketing",
  name: "Ticketing User",
  active: true,
  roles: ["Ticketing"],
};

describe("applyQueryTeamAssignments", () => {
  test("allows Sales to make the initial contracting assignment with ticketing scope", async () => {
    const { ctx, tables } = makeAssignmentCtx({
      queries: [{ ...baseQuery, salesOwnerId: "auth_sales" }],
      staffUsers: [contractingStaff],
      jobCards: [],
      contractingAssignments: [],
    });
    const createActivity = spyOn(lib, "createActivity").mockImplementation(async () => {});
    const notifyStaffMember = spyOn(lib, "notifyStaffMember").mockImplementation(async () => {});
    const notifyRoles = spyOn(lib, "notifyRoles").mockImplementation(async () => {});

    try {
      await applyQueryTeamAssignments(ctx as never, salesAccess(), {
        queryId: "queries_1",
        contractingStaffId: "staffUsers_contracting",
        ticketingScope: "Both",
      });

      expect(tables.queries[0]).toMatchObject({
        contractingOwnerId: "staffUsers_contracting",
        contractingOwnerName: "Contracting User",
        contractingStatus: "Query Received",
        ticketingScope: "Both",
      });
      expect(notifyStaffMember).toHaveBeenCalledWith(
        expect.anything(),
        "staffUsers_contracting",
        expect.objectContaining({ title: "Assign contracting owner" }),
      );
      expect(notifyRoles).toHaveBeenCalledWith(
        expect.anything(),
        ["Contracting Head", "Operations Head", "Head of Ticketing"],
        expect.objectContaining({ title: "Query team assigned by Sales" }),
      );
    } finally {
      createActivity.mockRestore();
      notifyStaffMember.mockRestore();
      notifyRoles.mockRestore();
    }
  });

  test("assigns contracting and ticketing in one write", async () => {
    const { ctx, tables } = makeAssignmentCtx({
      queries: [{ ...baseQuery }],
      staffUsers: [contractingStaff, ticketingStaff],
      jobCards: [{ _id: "jobCards_1", queryId: "queries_1" }],
      contractingAssignments: [],
    });
    const createActivity = spyOn(lib, "createActivity").mockImplementation(async () => {});
    const notifyStaffMember = spyOn(lib, "notifyStaffMember").mockImplementation(async () => {});

    try {
      const result = await applyQueryTeamAssignments(ctx as never, headAccess(), {
        queryId: "queries_1",
        contractingStaffId: "staffUsers_contracting",
        ticketingStaffId: "staffUsers_ticketing",
        ticketingScope: "International",
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
      expect(notifyStaffMember).toHaveBeenCalledTimes(2);
    } finally {
      createActivity.mockRestore();
      notifyStaffMember.mockRestore();
    }
  });

  test("supports contracting-only assignment", async () => {
    const { ctx, tables } = makeAssignmentCtx({
      queries: [{ ...baseQuery }],
      staffUsers: [contractingStaff],
      jobCards: [],
      contractingAssignments: [],
    });
    const createActivity = spyOn(lib, "createActivity").mockImplementation(async () => {});
    const notifyStaffMember = spyOn(lib, "notifyStaffMember").mockImplementation(async () => {});

    try {
      await applyQueryTeamAssignments(ctx as never, headAccess(), {
        queryId: "queries_1",
        contractingStaffId: "staffUsers_contracting",
      });

      expect(tables.queries[0]?.contractingOwnerId).toBe("staffUsers_contracting");
      expect(tables.queries[0]).not.toHaveProperty("ticketingOwnerId");
      expect(tables.contractingAssignments).toHaveLength(1);
      expect(createActivity).toHaveBeenCalledTimes(1);
      expect(notifyStaffMember).toHaveBeenCalledTimes(1);
    } finally {
      createActivity.mockRestore();
      notifyStaffMember.mockRestore();
    }
  });

  test("notifies only contracting and operations heads when ticketing is not required", async () => {
    const { ctx } = makeAssignmentCtx({
      queries: [{ ...baseQuery, salesOwnerId: "auth_sales" }],
      staffUsers: [contractingStaff],
      jobCards: [],
      contractingAssignments: [],
    });
    const createActivity = spyOn(lib, "createActivity").mockImplementation(async () => {});
    const notifyStaffMember = spyOn(lib, "notifyStaffMember").mockImplementation(async () => {});
    const notifyRoles = spyOn(lib, "notifyRoles").mockImplementation(async () => {});

    try {
      await applyQueryTeamAssignments(ctx as never, salesAccess(), {
        queryId: "queries_1",
        contractingStaffId: "staffUsers_contracting",
        ticketingScope: "Not required",
      });

      expect(notifyRoles).toHaveBeenCalledWith(
        expect.anything(),
        ["Contracting Head", "Operations Head"],
        expect.objectContaining({ title: "Query team assigned by Sales" }),
      );
    } finally {
      createActivity.mockRestore();
      notifyStaffMember.mockRestore();
      notifyRoles.mockRestore();
    }
  });

  test("prevents Sales from reassigning after initial assignment", async () => {
    const { ctx } = makeAssignmentCtx({
      queries: [
        {
          ...baseQuery,
          salesOwnerId: "auth_sales",
          contractingOwnerId: "staffUsers_existing",
          ticketingScope: "Domestic",
          submittedToContractingAt: Date.now(),
        },
      ],
      staffUsers: [contractingStaff],
      jobCards: [],
      contractingAssignments: [],
    });

    await expect(
      applyQueryTeamAssignments(ctx as never, salesAccess(), {
        queryId: "queries_1",
        contractingStaffId: "staffUsers_contracting",
        ticketingScope: "Both",
      }),
    ).rejects.toEqual(new ConvexError("Only heads can reassign query teams."));
  });

  test("allows Sales to make the first assignment after query submission when no team fields exist", async () => {
    const { ctx, tables } = makeAssignmentCtx({
      queries: [
        {
          ...baseQuery,
          salesOwnerId: "auth_sales",
          submittedToContractingAt: Date.now(),
        },
      ],
      staffUsers: [contractingStaff],
      jobCards: [],
      contractingAssignments: [],
    });
    const createActivity = spyOn(lib, "createActivity").mockImplementation(async () => {});
    const notifyStaffMember = spyOn(lib, "notifyStaffMember").mockImplementation(async () => {});
    const notifyRoles = spyOn(lib, "notifyRoles").mockImplementation(async () => {});

    try {
      await applyQueryTeamAssignments(ctx as never, salesAccess(), {
        queryId: "queries_1",
        contractingStaffId: "staffUsers_contracting",
        ticketingScope: "Domestic",
      });

      expect(tables.queries[0]).toMatchObject({
        contractingOwnerId: "staffUsers_contracting",
        ticketingScope: "Domestic",
      });
      expect(notifyStaffMember).toHaveBeenCalledWith(
        expect.anything(),
        "staffUsers_contracting",
        expect.objectContaining({ title: "Assign contracting owner" }),
      );
    } finally {
      createActivity.mockRestore();
      notifyStaffMember.mockRestore();
      notifyRoles.mockRestore();
    }
  });

  test("rejects invalid ticketing scope", async () => {
    const { ctx } = makeAssignmentCtx({
      queries: [{ ...baseQuery, salesOwnerId: "auth_sales" }],
      staffUsers: [contractingStaff],
      jobCards: [],
      contractingAssignments: [],
    });

    await expect(
      applyQueryTeamAssignments(ctx as never, salesAccess(), {
        queryId: "queries_1",
        contractingStaffId: "staffUsers_contracting",
        ticketingScope: "Regional",
      }),
    ).rejects.toEqual(new ConvexError("Select a valid Ticketing Scope."));
  });

  test("supports ticketing-only assignment", async () => {
    const { ctx, tables } = makeAssignmentCtx({
      queries: [{ ...baseQuery }],
      staffUsers: [ticketingStaff],
      jobCards: [],
    });
    const createActivity = spyOn(lib, "createActivity").mockImplementation(async () => {});
    const notifyStaffMember = spyOn(lib, "notifyStaffMember").mockImplementation(async () => {});

    try {
      await applyQueryTeamAssignments(ctx as never, headAccess(), {
        queryId: "queries_1",
        ticketingStaffId: "staffUsers_ticketing",
      });

      expect(tables.queries[0]?.ticketingOwnerId).toBe("staffUsers_ticketing");
      expect(tables.queries[0]).not.toHaveProperty("contractingOwnerId");
      expect(tables.contractingAssignments ?? []).toHaveLength(0);
      expect(createActivity).toHaveBeenCalledTimes(1);
      expect(notifyStaffMember).toHaveBeenCalledTimes(1);
    } finally {
      createActivity.mockRestore();
      notifyStaffMember.mockRestore();
    }
  });

  test("does not partially commit when the second assignee is invalid", async () => {
    const { ctx, tables } = makeAssignmentCtx({
      queries: [{ ...baseQuery }],
      staffUsers: [
        contractingStaff,
        { _id: "staffUsers_sales", name: "Sales User", active: true, roles: ["Sales"] },
      ],
      jobCards: [],
      contractingAssignments: [],
    });

    await expect(
      applyQueryTeamAssignments(ctx as never, headAccess(), {
        queryId: "queries_1",
        contractingStaffId: "staffUsers_contracting",
        ticketingStaffId: "staffUsers_sales",
      }),
    ).rejects.toThrow("Selected staff member is not on the ticketing team");

    expect(tables.queries[0]).not.toHaveProperty("contractingOwnerId");
    expect(tables.contractingAssignments).toHaveLength(0);
  });

  test("rejects queries the caller cannot see", async () => {
    const { ctx } = makeAssignmentCtx({
      queries: [{ ...baseQuery }],
      staffUsers: [contractingStaff],
    });

    await expect(
      applyQueryTeamAssignments(
        ctx as never,
        headAccess({ roles: ["Ticketing"], staffId: "staffUsers_other" }),
        {
          queryId: "queries_1",
          contractingStaffId: "staffUsers_contracting",
        },
      ),
    ).rejects.toEqual(new ConvexError("FORBIDDEN"));
  });

  test("requires at least one assignee", async () => {
    const { ctx } = makeAssignmentCtx({
      queries: [{ ...baseQuery }],
      staffUsers: [contractingStaff],
    });

    await expect(
      applyQueryTeamAssignments(ctx as never, headAccess(), { queryId: "queries_1" }),
    ).rejects.toEqual(new ConvexError("Select a contracting and/or ticketing SPOC."));
  });
});
