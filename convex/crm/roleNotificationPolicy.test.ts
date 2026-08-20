import { describe, expect, test } from "bun:test";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import type { FunctionReference } from "convex/server";
import type { Id } from "../_generated/dataModel";
import type { RuntimeObject, RuntimeValue } from "../lib/runtimeValues";
import { assertBulkDeleteLimit } from "./lib/bulkOps";
import { notifyStaffMember } from "./lib/notifications";
import { canSeeProposalRecord, canSeeQueryRecord } from "./lib/recordScope";
import { getRolePermissions, PERMISSIONS, TEAM_PICKER_PERMISSIONS } from "./lib/rolePolicy";
import type { PortalAccess } from "./lib/staffAccess";

describe("Role permissions", () => {
  test("Directors receive full Admin permissions", () => {
    const admin = getRolePermissions(["Admin"]).sort();
    const directors = getRolePermissions(["Directors"]).sort();
    expect(directors).toEqual(admin);
  });

  test("Director Cement excludes staff/dropdown/activity permissions", () => {
    const directorCement = new Set(getRolePermissions(["Director Cement"]));
    expect(directorCement.has(PERMISSIONS.MANAGE_STAFF)).toBe(false);
    expect(directorCement.has(PERMISSIONS.MANAGE_DROPDOWNS)).toBe(false);
    expect(directorCement.has(PERMISSIONS.VIEW_ACTIVITY)).toBe(false);
    expect(directorCement.has(PERMISSIONS.MANAGE_QUERIES)).toBe(true);
  });

  test("Accounts can manage job cards", () => {
    const accounts = new Set(getRolePermissions(["Accounts"]));
    expect(accounts.has(PERMISSIONS.MANAGE_JOB_CARDS)).toBe(true);
    expect(accounts.has(PERMISSIONS.VIEW_JOB_CARDS)).toBe(true);
  });

  test("Team picker permissions include assignment workflows without view:team alone", () => {
    expect(TEAM_PICKER_PERMISSIONS).toContain(PERMISSIONS.MANAGE_QUERIES);
    expect(TEAM_PICKER_PERMISSIONS).toContain(PERMISSIONS.MANAGE_CONTRACTING);
    expect(TEAM_PICKER_PERMISSIONS).not.toContain(PERMISSIONS.VIEW_QUERIES);
  });
});

describe("Record visibility", () => {
  function access(roles: string[], staffId?: Id<"staffUsers">): PortalAccess {
    return {
      allowed: true,
      email: "staff@citiusholidays.com",
      name: "Staff User",
      permissions: [],
      roles,
      staffId,
    };
  }

  test("Cement role cannot see non-cement queries", () => {
    const viewer = access(["Sales Cement"]);
    const query = { queryType: "FIT", salesOwnerName: "Other" };
    expect(canSeeQueryRecord(viewer, query)).toBe(false);
  });

  test("Director Cement sees all cement queries", () => {
    const viewer = access(["Director Cement"]);
    const query = { queryType: "Cement", salesOwnerName: "Other" };
    expect(canSeeQueryRecord(viewer, query)).toBe(true);
  });

  test("Collaborator ownership is honored on proposals", () => {
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const viewer = access(["Contracting"], fromPartial<Id<"staffUsers">>("staff_collab"));
    const proposal = { collaboratorStaffIds: ["staff_collab"], preparedBy: "Other" };
    expect(canSeeProposalRecord(viewer, proposal, [])).toBe(true);
  });
});

describe("Notification delivery", () => {
  test("NotifyStaffMember targets staff id for bell when auth relinks", async () => {
    const tables = {
      notificationEmailEventOrigins: [],
      notifications: [],
      notificationTargetCounts: [],
      operationalControlStates: [
        { key: "notifications.crm_bell", state: "default" },
        { key: "email.crm_workflow", state: "default" },
      ],
      operationalEffectReceipts: [],
      staffUsers: [],
    } satisfies Record<string, unknown[]>;
    const scheduled: unknown[] = [];
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const staffId = fromPartial<Id<"staffUsers">>("staff_a");
    tables.staffUsers = [
      {
        _id: staffId,
        active: true,
        authUserId: "user_a",
        email: "staff@example.com",
        roles: ["Sales"],
      },
    ];
    const ctx = {
      db: {
        get: async (_table: string, id: Id<"staffUsers">) =>
          // SAFETY: This test controls the asserted value at the framework boundary below.
          tables.staffUsers.find((row) => fromPartial<{ _id: string }>(row)._id === id) ?? null,
        insert: (table: string, doc: RuntimeObject) => {
          const row = { _id: `${table}_${tables[table].length + 1}`, ...doc };
          tables[table].push(row);
          return row._id;
        },
        query: (table: string) => {
          let rows = tables[table] ?? [];
          const builder = {
            collect: async () => rows,
            take: async (count: number) => rows.slice(0, count),
            unique: async () => rows[0] ?? null,
            withIndex: (_index: string, callback: (range: RuntimeValue) => RuntimeValue) => {
              const filters: { field: string; value: unknown }[] = [];
              const range = {
                eq: (field: string, value: RuntimeValue) => {
                  filters.push({ field, value });
                  return range;
                },
              };
              callback(range);
              rows = rows.filter((row) =>
                filters.every(
                  // SAFETY: This test controls the asserted value at the framework boundary below.
                  ({ field, value }) => fromPartial<RuntimeObject>(row)[field] === value
                )
              );
              return builder;
            },
          };
          return builder;
        },
      },
      scheduler: {
        runAfter: (
          _delay: number,
          _fn: FunctionReference<"mutation", "internal">,
          args: RuntimeObject
        ) => {
          scheduled.push(args);
        },
      },
    };

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await notifyStaffMember(fromAny<never, unknown>(ctx), staffId, {
      body: "Hello",
      title: "Ping",
    });

    expect(tables.notifications).toHaveLength(1);
    expect(tables.notifications[0]).toMatchObject({
      recipientStaffId: staffId,
      recipientUserId: "user_a",
    });
    expect(scheduled).toHaveLength(1);
  });

  test("NotifyStaffMember keeps additional email roles compatible with role-default delivery", async () => {
    const tables = {
      notificationEmailEventOrigins: [],
      notifications: [],
      notificationTargetCounts: [],
      operationalControlStates: [
        { key: "notifications.crm_bell", state: "default" },
        { key: "email.crm_workflow", state: "default" },
      ],
      operationalEffectReceipts: [],
      staffUsers: [],
    } satisfies Record<string, unknown[]>;
    const scheduled: unknown[] = [];
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const staffId = fromPartial<Id<"staffUsers">>("staff_email_opt_in");
    tables.staffUsers = [
      {
        _id: staffId,
        active: true,
        authUserId: "user_email_opt_in",
        email: "staff@example.com",
        emailAlertRoles: ["Sales"],
        roles: ["Sales"],
      },
    ];
    const ctx = {
      db: {
        get: async (_table: string, id: Id<"staffUsers">) =>
          // SAFETY: This test controls the asserted value at the framework boundary below.
          tables.staffUsers.find((row) => fromPartial<{ _id: string }>(row)._id === id) ?? null,
        insert: (table: string, doc: RuntimeObject) => {
          const row = { _id: `${table}_${tables[table].length + 1}`, ...doc };
          tables[table].push(row);
          return row._id;
        },
        query: (table: string) => {
          let rows = tables[table] ?? [];
          const builder = {
            collect: async () => rows,
            take: async (count: number) => rows.slice(0, count),
            unique: async () => rows[0] ?? null,
            withIndex: (_index: string, callback: (range: RuntimeValue) => RuntimeValue) => {
              const filters: { field: string; value: unknown }[] = [];
              const range = {
                eq: (field: string, value: RuntimeValue) => {
                  filters.push({ field, value });
                  return range;
                },
              };
              callback(range);
              rows = rows.filter((row) =>
                filters.every(
                  // SAFETY: This test controls the asserted value at the framework boundary below.
                  ({ field, value }) => fromPartial<RuntimeObject>(row)[field] === value
                )
              );
              return builder;
            },
          };
          return builder;
        },
      },
      scheduler: {
        runAfter: (
          _delay: number,
          _fn: FunctionReference<"mutation", "internal">,
          args: RuntimeObject
        ) => {
          scheduled.push(args);
        },
      },
    };

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await notifyStaffMember(fromAny<never, unknown>(ctx), staffId, {
      body: "Hello",
      title: "Ping",
    });

    expect(tables.notifications).toHaveLength(1);
    expect(scheduled).toHaveLength(1);
  });
});

describe("Bulk delete policy", () => {
  test("Rejects zero selection without a cap on positive counts", () => {
    expect(() => assertBulkDeleteLimit(0)).toThrow();
    expect(() => assertBulkDeleteLimit(100)).not.toThrow();
  });
});
