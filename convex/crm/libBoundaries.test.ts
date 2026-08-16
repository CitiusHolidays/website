import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import type { FunctionReference } from "convex/server";
import type { Id } from "../_generated/dataModel";
import type { RuntimeObject, RuntimeValue } from "../lib/runtimeValues";
import * as facade from "./lib";
import * as notifications from "./lib/notifications";
import * as recordScope from "./lib/recordScope";
import * as rolePolicy from "./lib/rolePolicy";
import * as staffAccess from "./lib/staffAccess";
import * as validators from "./lib/validators";

const FACADE_EXPORTS = [
  "ALL_ROLES",
  "BULK_DELETE_MUTATION_BATCH_SIZE",
  "CEMENT_QUERY_TYPES",
  "CEMENT_ROLES",
  "CONTRACTING_TEAM_ROLES",
  "DIRECTOR_PERMISSIONS",
  "HEAD_ROLES",
  "MAX_QUERY_NOTES_WORDS",
  "NOTIFICATION_EMAIL_STAGGER_MS",
  "PAYMENT_TERMS",
  "PERMISSIONS",
  "ROLE_PERMISSIONS",
  "SALES_REP_ROLES",
  "TEAM_PICKER_PERMISSIONS",
  "TICKETING_TEAM_ROLES",
  "applyCementPortalScope",
  "assertBulkDeleteLimit",
  "assertBulkDeleteMutationBatch",
  "assertCementQueryTypeAllowed",
  "assertDateRangeOrder",
  "assertMaxWordCount",
  "canActAsLeaveHeadReviewer",
  "canEditContractingRecord",
  "canEditOperationsRecord",
  "canEditProposalRecord",
  "canHeadReview",
  "canReceiveNotification",
  "canSeeAllCementRecords",
  "canSeeAllPortalRecords",
  "canSeeDepartmentRecords",
  "canSeeJobCardRecord",
  "canSeeProposalRecord",
  "canSeeQueryRecord",
  "contractingNotifyRolesForQueryType",
  "countWords",
  "createActivity",
  "creatorInitials",
  "deleteEntityNotifications",
  "deleteJobCardCascade",
  "deleteStorageFile",
  "editorPatch",
  "endOfPortalDateOnly",
  "expandNotificationEmailRoles",
  "filterRecordsByDateRange",
  "flushDeferredNotificationCleanup",
  "getHeadReviewerRolesForStaff",
  "getLeaveApprovalActions",
  "getPortalAccess",
  "getRolePermissions",
  "hasCementRole",
  "hasRole",
  "isAdmin",
  "isAdminDirectorOrRole",
  "isCollaborator",
  "isCementQueryType",
  "isDefined",
  "isDirectorOrAdmin",
  "isHead",
  "isHrReviewer",
  "nextCode",
  "normalizeEmail",
  "notifyRoles",
  "notifyStaffMatching",
  "notifyStaffMember",
  "publishWorkflowNotification",
  "ownsAuthRecord",
  "ownsNamedRecord",
  "ownsStaffRecord",
  "parsePortalDateOnly",
  "paymentTermsFor",
  "portalDateRangeValidator",
  "publicJobCard",
  "publicQuery",
  "publicTravelBatch",
  "requestedProposalQueryIds",
  "requireAnyPermission",
  "requireHeadOrAdmin",
  "requireStaff",
  "resolvePortalDateRange",
  "shouldApplyCementScope",
] as const;

describe("lib facade parity", () => {
  test("re-exports every stable CRM lib symbol", () => {
    for (const exportName of FACADE_EXPORTS) {
      expect(facade).toHaveProperty(exportName);
    }
  });

  test("facade stays within the documented line budget", async () => {
    const source = await readFile(new URL("./lib.ts", import.meta.url), "utf8");
    const lineCount = source.split("\n").length;
    expect(lineCount).toBeLessThanOrEqual(200);
  });

  test("focused modules stay under 500 lines each", async () => {
    const modulePaths = [
      "./lib/rolePolicy.ts",
      "./lib/staffAccess.ts",
      "./lib/recordScope.ts",
      "./lib/leavePolicy.ts",
      "./lib/notifications.ts",
      "./lib/validators.ts",
      "./lib/activity.ts",
      "./lib/codes.ts",
      "./lib/bulkOps.ts",
      "./lib/presentation.ts",
    ];
    for (const path of modulePaths) {
      const source = await readFile(new URL(path, import.meta.url), "utf8");
      const lineCount = source.split("\n").length;
      expect(lineCount).toBeLessThanOrEqual(500);
    }
  });
});

describe("role policy parity", () => {
  test("Directors receive full Admin permissions", () => {
    const admin = rolePolicy.getRolePermissions(["Admin"]).sort();
    const directors = rolePolicy.getRolePermissions(["Directors"]).sort();
    expect(directors).toEqual(admin);
  });

  test("Director Cement excludes staff/dropdown/activity permissions", () => {
    const directorCement = new Set(rolePolicy.getRolePermissions(["Director Cement"]));
    expect(directorCement.has(rolePolicy.PERMISSIONS.MANAGE_STAFF)).toBe(false);
    expect(directorCement.has(rolePolicy.PERMISSIONS.MANAGE_DROPDOWNS)).toBe(false);
    expect(directorCement.has(rolePolicy.PERMISSIONS.VIEW_ACTIVITY)).toBe(false);
    expect(directorCement.has(rolePolicy.PERMISSIONS.MANAGE_QUERIES)).toBe(true);
  });

  test("Accounts can manage job cards", () => {
    const accounts = new Set(rolePolicy.getRolePermissions(["Accounts"]));
    expect(accounts.has(rolePolicy.PERMISSIONS.MANAGE_JOB_CARDS)).toBe(true);
    expect(accounts.has(rolePolicy.PERMISSIONS.VIEW_JOB_CARDS)).toBe(true);
  });

  test("team picker permissions include assignment workflows without view:team alone", () => {
    expect(rolePolicy.TEAM_PICKER_PERMISSIONS).toContain(rolePolicy.PERMISSIONS.MANAGE_QUERIES);
    expect(rolePolicy.TEAM_PICKER_PERMISSIONS).toContain(rolePolicy.PERMISSIONS.MANAGE_CONTRACTING);
    expect(rolePolicy.TEAM_PICKER_PERMISSIONS).not.toContain(rolePolicy.PERMISSIONS.VIEW_QUERIES);
  });

  test("facade role helpers match focused module", () => {
    const access = {
      allowed: true,
      email: "d@citiusholidays.com",
      name: "Director",
      permissions: rolePolicy.getRolePermissions(["Directors"]),
      roles: ["Directors"],
    };
    expect(facade.isDirectorOrAdmin(access)).toBe(staffAccess.isDirectorOrAdmin(access));
    expect(facade.isAdmin(access)).toBe(staffAccess.isAdmin(access));
  });
});

describe("record scope parity", () => {
  function access(roles: string[], staffId?: Id<"staffUsers">): staffAccess.PortalAccess {
    return {
      allowed: true,
      email: "staff@citiusholidays.com",
      name: "Staff User",
      permissions: [],
      roles,
      staffId,
    };
  }

  test("cement role cannot see non-cement queries", () => {
    const viewer = access(["Sales Cement"]);
    const query = { queryType: "FIT", salesOwnerName: "Other" };
    expect(recordScope.canSeeQueryRecord(viewer, query)).toBe(false);
    expect(facade.canSeeQueryRecord(viewer, query)).toBe(false);
  });

  test("Director Cement sees all cement queries", () => {
    const viewer = access(["Director Cement"]);
    const query = { queryType: "Cement", salesOwnerName: "Other" };
    expect(recordScope.canSeeQueryRecord(viewer, query)).toBe(true);
  });

  test("collaborator ownership is honored on proposals", () => {
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const viewer = access(["Contracting"], "staff_collab" as Id<"staffUsers">);
    const proposal = { collaboratorStaffIds: ["staff_collab"], preparedBy: "Other" };
    expect(recordScope.canSeeProposalRecord(viewer, proposal, [])).toBe(true);
  });
});

describe("notification boundary parity", () => {
  test("validator export identity is preserved through facade", () => {
    expect(facade.portalDateRangeValidator).toBe(validators.portalDateRangeValidator);
  });

  test("expandNotificationEmailRoles matches facade re-export", () => {
    const roles = ["Sales", "Ticketing"];
    expect(facade.expandNotificationEmailRoles(roles)).toEqual(
      notifications.expandNotificationEmailRoles(roles)
    );
  });

  test("canReceiveNotification matches facade re-export", () => {
    const notification = {
      // SAFETY: This test controls the asserted value at the framework boundary below.
      recipientStaffId: "staff_a" as Id<"staffUsers">,
      recipientUserId: "old",
    };
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const access = { authUserId: "new", roles: [], staffId: "staff_a" as Id<"staffUsers"> };
    expect(facade.canReceiveNotification(notification, access)).toBe(
      notifications.canReceiveNotification(notification, access)
    );
  });

  test("notifyStaffMember targets staff id for bell when auth relinks", async () => {
    const tables = {
      notifications: [],
      notificationTargetCounts: [],
      staffUsers: [],
    } satisfies Record<string, unknown[]>;
    const scheduled: unknown[] = [];
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const staffId = "staff_a" as Id<"staffUsers">;
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
          tables.staffUsers.find((row) => (row as { _id: string })._id === id) ?? null,
        insert: (table: string, doc: RuntimeObject) => {
          const row = { _id: `${table}_${tables[table].length + 1}`, ...doc };
          tables[table].push(row);
          return row._id;
        },
        query: (table: string) => {
          let rows = tables[table] ?? [];
          const builder = {
            collect: async () => rows,
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
                  ({ field, value }) => (row as RuntimeObject)[field] === value
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
    await notifications.notifyStaffMember(ctx as never, staffId, {
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

  test("notifyStaffMember keeps additional email roles compatible with role-default delivery", async () => {
    const tables = {
      notifications: [],
      notificationTargetCounts: [],
      staffUsers: [],
    } satisfies Record<string, unknown[]>;
    const scheduled: unknown[] = [];
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const staffId = "staff_email_opt_in" as Id<"staffUsers">;
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
          tables.staffUsers.find((row) => (row as { _id: string })._id === id) ?? null,
        insert: (table: string, doc: RuntimeObject) => {
          const row = { _id: `${table}_${tables[table].length + 1}`, ...doc };
          tables[table].push(row);
          return row._id;
        },
        query: (table: string) => {
          let rows = tables[table] ?? [];
          const builder = {
            collect: async () => rows,
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
                  ({ field, value }) => (row as RuntimeObject)[field] === value
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
    await notifications.notifyStaffMember(ctx as never, staffId, {
      body: "Hello",
      title: "Ping",
    });

    expect(tables.notifications).toHaveLength(1);
    expect(scheduled).toHaveLength(1);
  });
});

describe("bulk delete policy", () => {
  test("rejects zero selection without a cap on positive counts", () => {
    expect(() => facade.assertBulkDeleteLimit(0)).toThrow();
    expect(() => facade.assertBulkDeleteLimit(100)).not.toThrow();
  });
});
