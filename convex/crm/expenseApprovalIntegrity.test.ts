import { describe, expect, test } from "bun:test";
import type { Id } from "../_generated/dataModel";
import { decide as decideApproval } from "./approvals";
import { saveExpenseProof } from "./expenseAttachments";
import {
  decideExpenseFinance,
  decideExpenseManager,
  listExpenses,
  removeExpense,
  submitExpenseForApproval,
  updateExpense,
} from "./finance";

interface Row {
  _id: string;
  [key: string]: unknown;
}
type Tables = Record<string, Row[]>;

function makeExpenseCtx(initialTables: Tables, identitySubject: string) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))])
  ) as Tables;
  let subject = identitySubject;

  const ctx = {
    auth: {
      getUserIdentity: () => {
        const staff = tables.staffUsers.find((row) => row.authUserId === subject);
        return Promise.resolve(
          staff
            ? {
                email: staff.email,
                name: staff.name,
                subject,
              }
            : null
        );
      },
    },
    db: {
      delete: (id: string) => {
        for (const rows of Object.values(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            rows.splice(index, 1);
            return Promise.resolve();
          }
        }
        return Promise.resolve();
      },
      get: (id: string) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((entry) => entry._id === id);
          if (row) {
            return Promise.resolve(row);
          }
        }
        return Promise.resolve(null);
      },
      insert: (table: string, value: Record<string, unknown>) => {
        const rows = tables[table] ?? [];
        tables[table] = rows;
        const id = `${table}_${rows.length + 1}`;
        rows.push({ _id: id, ...value });
        return Promise.resolve(id);
      },
      normalizeId(table: string, id: string) {
        return (tables[table] ?? []).some((row) => row._id === id) ? id : null;
      },
      patch: (id: string, value: Record<string, unknown>) => {
        for (const rows of Object.values(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            rows[index] = { ...rows[index], ...value };
            return Promise.resolve();
          }
        }
        return Promise.resolve();
      },
      query(table: string) {
        let rows = tables[table] ?? [];
        const query = {
          collect: () => Promise.resolve([...rows]),
          filter: (callback: (q: any) => unknown) => {
            const q = {
              and: (...values: boolean[]) => values.every(Boolean),
              eq: (left: unknown, right: unknown) => left === right,
              field: (field: string) => ({ field }),
            };
            const predicate = callback(q) as boolean;
            if (typeof predicate === "boolean" && !predicate) {
              rows = [];
            }
            return query;
          },
          first: () => Promise.resolve(rows[0] ?? null),
          order: (direction: "asc" | "desc") => {
            if (direction === "desc") {
              rows = [...rows].reverse();
            }
            return query;
          },
          paginate: ({ numItems }: { numItems: number }) =>
            Promise.resolve({
              continueCursor: "",
              isDone: rows.length <= numItems,
              page: rows.slice(0, numItems),
            }),
          take: (count: number) => Promise.resolve(rows.slice(0, count)),
          unique: () => Promise.resolve(rows[0] ?? null),
          withIndex(_indexName: string, callback: (q: unknown) => unknown) {
            const filters: Array<{ field: string; value: unknown }> = [];
            const q = {
              eq(field: string, value: unknown) {
                filters.push({ field, value });
                return q;
              },
            };
            callback?.(q);
            rows = rows.filter((row) =>
              filters.every((filter) => row[filter.field] === filter.value)
            );
            return query;
          },
        };
        return query;
      },
    },
    scheduler: {
      runAfter: async () => undefined,
    },
    storage: {
      delete: async () => undefined,
      get: async () => null,
    },
  };

  return {
    ctx,
    setIdentity(nextSubject: string) {
      subject = nextSubject;
    },
    tables,
  };
}

const ownerStaff = {
  _id: "staff_owner" as Id<"staffUsers">,
  active: true,
  authUserId: "auth_owner",
  email: "owner@citius.in",
  emailNormalized: "owner@citius.in",
  name: "Expense Owner",
  roles: ["Sales"],
};

const otherStaff = {
  _id: "staff_other" as Id<"staffUsers">,
  active: true,
  authUserId: "auth_other",
  email: "other@citius.in",
  emailNormalized: "other@citius.in",
  name: "Other Employee",
  roles: ["Sales"],
};

const financeStaff = {
  _id: "staff_finance" as Id<"staffUsers">,
  active: true,
  authUserId: "auth_finance",
  email: "finance@citius.in",
  emailNormalized: "finance@citius.in",
  name: "Finance User",
  roles: ["Finance"],
};

const managerStaff = {
  _id: "staff_manager" as Id<"staffUsers">,
  active: true,
  authUserId: "auth_manager",
  email: "manager@citius.in",
  emailNormalized: "manager@citius.in",
  name: "Reporting Manager",
  roles: ["Sales Head"],
};

function officeExpense(id: string, createdBy: string, overrides: Partial<Row> = {}) {
  return {
    _id: id,
    amount: 1000,
    approvalStatus: "Pending",
    category: "Meals",
    createdAt: 1_700_000_000_000,
    createdBy,
    paidBy: "Employee",
    reimbursementStatus: "Not Submitted",
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe("expense approval integrity", () => {
  test("ordinary staff see only their own unlinked office expenses while Finance sees all", async () => {
    const { ctx, setIdentity } = makeExpenseCtx(
      {
        expenseEntries: [
          officeExpense("expense_owner", "auth_owner"),
          officeExpense("expense_other", "auth_other"),
        ],
        staffUsers: [ownerStaff, otherStaff, financeStaff],
      },
      "auth_owner"
    );

    const ownerRows = await (listExpenses as any)._handler(ctx, {
      paginationOpts: { cursor: null, numItems: 50 },
    });
    expect(ownerRows.page.map((row: { id: string }) => row.id)).toEqual(["expense_owner"]);

    setIdentity("auth_finance");
    const financeRows = await (listExpenses as any)._handler(ctx, {
      paginationOpts: { cursor: null, numItems: 50 },
    });
    expect(financeRows.page.map((row: { id: string }) => row.id)).toEqual([
      "expense_other",
      "expense_owner",
    ]);
  });

  test("unlinked expense edits are creator-only except for explicit manage-all oversight", async () => {
    const { ctx, setIdentity, tables } = makeExpenseCtx(
      {
        expenseEntries: [
          officeExpense("expense_owner", "auth_owner"),
          officeExpense("expense_other", "auth_other"),
        ],
        staffUsers: [ownerStaff, otherStaff, financeStaff],
      },
      "auth_owner"
    );

    await (updateExpense as any)._handler(ctx, {
      category: "Local transport",
      expenseId: "expense_owner",
    });
    expect(tables.expenseEntries[0]?.category).toBe("Local transport");

    await expect(
      (updateExpense as any)._handler(ctx, {
        category: "Should not apply",
        expenseId: "expense_other",
      })
    ).rejects.toThrow("FORBIDDEN");

    setIdentity("auth_finance");
    await (updateExpense as any)._handler(ctx, {
      category: "Finance correction",
      expenseId: "expense_other",
    });
    expect(tables.expenseEntries[1]?.category).toBe("Finance correction");
  });

  test("a material edit after manager approval invalidates the snapshot and restarts approval", async () => {
    const { ctx, setIdentity, tables } = makeExpenseCtx(
      {
        approvalRequests: [],
        expenseEntries: [officeExpense("expense_owner", "auth_owner", { approvalVersion: 1 })],
        staffUsers: [
          { ...ownerStaff, reportingManagerStaffId: managerStaff._id },
          managerStaff,
          financeStaff,
        ],
      },
      "auth_owner"
    );

    await (submitExpenseForApproval as any)._handler(ctx, { expenseId: "expense_owner" });
    setIdentity("auth_manager");
    await (decideExpenseManager as any)._handler(ctx, {
      expenseId: "expense_owner",
      status: "Approved",
    });

    expect(tables.expenseEntries[0]?.managerReviewStatus).toBe("Approved");
    expect(tables.approvalRequests[0]?.status).toBe("Pending");

    setIdentity("auth_owner");
    await (updateExpense as any)._handler(ctx, {
      category: "Lodging",
      expenseId: "expense_owner",
    });

    expect(tables.expenseEntries[0]).toMatchObject({
      approvalStatus: "Pending",
      approvalVersion: 2,
      financeReviewStatus: "Pending",
      managerReviewStatus: "Pending",
      reimbursementStatus: "Not Submitted",
    });
    expect(tables.expenseEntries[0]?.submittedForApprovalAt).toBeUndefined();
    expect(tables.approvalRequests[0]?.status).toBe("Needs Info");
  });

  test("Finance rejects a stale manager snapshot and accepts the matching current version", async () => {
    const { ctx, setIdentity, tables } = makeExpenseCtx(
      {
        approvalRequests: [],
        expenseEntries: [
          officeExpense("expense_owner", "auth_owner", {
            approvalVersion: 3,
            proofDigest: "digest-a",
          }),
        ],
        staffUsers: [
          { ...ownerStaff, reportingManagerStaffId: managerStaff._id },
          managerStaff,
          financeStaff,
        ],
      },
      "auth_owner"
    );

    await (submitExpenseForApproval as any)._handler(ctx, { expenseId: "expense_owner" });
    setIdentity("auth_manager");
    await (decideExpenseManager as any)._handler(ctx, {
      expenseId: "expense_owner",
      status: "Approved",
    });

    tables.expenseEntries[0] = { ...tables.expenseEntries[0], proofDigest: "digest-b" };
    setIdentity("auth_finance");
    await expect(
      (decideExpenseFinance as any)._handler(ctx, {
        expenseId: "expense_owner",
        status: "Approved",
      })
    ).rejects.toThrow("changed after manager approval");

    tables.expenseEntries[0] = { ...tables.expenseEntries[0], proofDigest: "digest-a" };
    await (decideExpenseFinance as any)._handler(ctx, {
      expenseId: "expense_owner",
      status: "Approved",
    });
    expect(tables.expenseEntries[0]?.approvalStatus).toBe("Approved");
    expect(tables.approvalRequests[0]?.status).toBe("Approved");
  });

  test("the generic approval path cannot decide a stale expense request", async () => {
    const approval = {
      _id: "approval_stale",
      amount: 1000,
      createdAt: 1_700_000_000_000,
      entityId: "expense_owner",
      entityType: "expense",
      expenseVersion: 2,
      proofDigest: "digest-a",
      requestCode: "APR-0001",
      requestedBy: "auth_owner",
      status: "Pending",
      summary: "Meals expense",
      type: "Expense",
      updatedAt: 1_700_000_000_000,
    };
    const { ctx, tables } = makeExpenseCtx(
      {
        approvalRequests: [approval],
        expenseEntries: [
          officeExpense("expense_owner", "auth_owner", {
            approvalVersion: 2,
            financeReviewStatus: "Pending",
            managerApprovedProofDigest: "digest-a",
            managerApprovedVersion: 2,
            managerReviewStatus: "Approved",
            proofDigest: "digest-b",
          }),
        ],
        staffUsers: [ownerStaff, financeStaff],
      },
      "auth_finance"
    );

    await expect(
      (decideApproval as any)._handler(ctx, {
        approvalId: "approval_stale",
        status: "Approved",
      })
    ).rejects.toThrow("changed after manager approval");
    expect(tables.approvalRequests[0]?.status).toBe("Pending");
    expect(tables.expenseEntries[0]?.approvalStatus).toBe("Pending");
  });

  test("proof replacement transactionally restarts approval and rejects a non-owner", async () => {
    const { ctx, setIdentity, tables } = makeExpenseCtx(
      {
        approvalRequests: [
          {
            _id: "approval_pending",
            createdAt: 1_700_000_000_000,
            entityId: "expense_owner",
            entityType: "expense",
            expenseVersion: 2,
            proofDigest: "digest-a",
            requestCode: "APR-0001",
            requestedBy: "auth_owner",
            status: "Pending",
            summary: "Meals expense",
            type: "Expense",
            updatedAt: 1_700_000_000_000,
          },
        ],
        attachments: [
          {
            _id: "attachment_old",
            contentDigest: "digest-a",
            createdAt: 1_700_000_000_000,
            createdBy: "auth_owner",
            entityId: "expense_owner",
            entityType: "expense",
            fileName: "old.pdf",
            mimeType: "application/pdf",
            storageId: "storage_old",
          },
        ],
        expenseEntries: [
          officeExpense("expense_owner", "auth_owner", {
            approvalVersion: 2,
            financeReviewStatus: "Pending",
            managerApprovedProofDigest: "digest-a",
            managerApprovedVersion: 2,
            managerReviewStatus: "Approved",
            proofAttachmentId: "attachment_old",
            proofDigest: "digest-a",
            submittedForApprovalAt: 1_700_000_000_100,
          }),
        ],
        staffUsers: [ownerStaff, otherStaff, financeStaff],
      },
      "auth_other"
    );

    await expect(
      (saveExpenseProof as any)._handler(ctx, {
        contentDigest: "digest-b",
        createdBy: "auth_other",
        expenseId: "expense_owner",
        fileName: "new.pdf",
        mimeType: "application/pdf",
        storageId: "storage_rejected",
      })
    ).rejects.toThrow("FORBIDDEN");

    setIdentity("auth_owner");
    const result = await (saveExpenseProof as any)._handler(ctx, {
      contentDigest: "digest-b",
      createdBy: "auth_owner",
      expenseId: "expense_owner",
      fileName: "new.pdf",
      mimeType: "application/pdf",
      storageId: "storage_new",
    });

    expect(result.previousStorageId).toBe("storage_old");
    expect(tables.expenseEntries[0]).toMatchObject({
      approvalVersion: 3,
      managerReviewStatus: "Pending",
      proofDigest: "digest-b",
      reimbursementStatus: "Not Submitted",
    });
    expect(tables.approvalRequests[0]?.status).toBe("Needs Info");
  });

  test("only the creator can submit or delete an unlinked expense without manage-all", async () => {
    const { ctx, setIdentity, tables } = makeExpenseCtx(
      {
        expenseEntries: [officeExpense("expense_owner", "auth_owner")],
        staffUsers: [
          { ...ownerStaff, reportingManagerStaffId: managerStaff._id },
          otherStaff,
          managerStaff,
        ],
      },
      "auth_other"
    );

    await expect(
      (submitExpenseForApproval as any)._handler(ctx, { expenseId: "expense_owner" })
    ).rejects.toThrow("FORBIDDEN");
    tables.expenseEntries[0] = {
      ...tables.expenseEntries[0],
      managerReviewStatus: "Pending",
      submittedForApprovalAt: 1_700_000_000_100,
    };
    await expect(
      (submitExpenseForApproval as any)._handler(ctx, { expenseId: "expense_owner" })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      (removeExpense as any)._handler(ctx, { expenseId: "expense_owner" })
    ).rejects.toThrow("FORBIDDEN");

    setIdentity("auth_owner");
    await (removeExpense as any)._handler(ctx, { expenseId: "expense_owner" });
    expect(tables.expenseEntries).toHaveLength(0);
  });

  test("Job Card visibility never grants mutation authority over another creator's expense", async () => {
    const { ctx, setIdentity, tables } = makeExpenseCtx(
      {
        approvalRequests: [],
        attachments: [],
        expenseEntries: [
          officeExpense("expense_linked", "auth_owner", { jobCardId: "job_visible" }),
        ],
        jobCards: [
          {
            _id: "job_visible",
            createdBy: "auth_owner",
            queryId: "query_visible",
          },
        ],
        queries: [
          {
            _id: "query_visible",
            createdBy: "auth_other",
            queryType: "MICE",
          },
        ],
        staffUsers: [ownerStaff, otherStaff],
      },
      "auth_other"
    );

    await expect(
      (updateExpense as any)._handler(ctx, {
        category: "Cross-record edit",
        expenseId: "expense_linked",
      })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      (submitExpenseForApproval as any)._handler(ctx, { expenseId: "expense_linked" })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      (saveExpenseProof as any)._handler(ctx, {
        contentDigest: "other-digest",
        createdBy: "auth_other",
        expenseId: "expense_linked",
        fileName: "other.pdf",
        mimeType: "application/pdf",
        storageId: "storage_other",
      })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      (removeExpense as any)._handler(ctx, { expenseId: "expense_linked" })
    ).rejects.toThrow("FORBIDDEN");

    setIdentity("auth_owner");
    await (updateExpense as any)._handler(ctx, {
      category: "Owner correction",
      expenseId: "expense_linked",
    });
    expect(tables.expenseEntries[0]?.category).toBe("Owner correction");
  });

  test("rejection, material correction, resubmission, and final approval form a new cycle", async () => {
    const { ctx, setIdentity, tables } = makeExpenseCtx(
      {
        approvalRequests: [],
        expenseEntries: [officeExpense("expense_owner", "auth_owner", { approvalVersion: 1 })],
        staffUsers: [
          { ...ownerStaff, reportingManagerStaffId: managerStaff._id },
          managerStaff,
          financeStaff,
        ],
      },
      "auth_owner"
    );

    await (submitExpenseForApproval as any)._handler(ctx, { expenseId: "expense_owner" });
    setIdentity("auth_manager");
    await (decideExpenseManager as any)._handler(ctx, {
      decisionNote: "Please correct the category",
      expenseId: "expense_owner",
      status: "Rejected",
    });
    expect(tables.expenseEntries[0]?.approvalStatus).toBe("Rejected");

    setIdentity("auth_owner");
    await (updateExpense as any)._handler(ctx, {
      category: "Transport",
      expenseId: "expense_owner",
    });
    await (submitExpenseForApproval as any)._handler(ctx, { expenseId: "expense_owner" });
    setIdentity("auth_manager");
    await (decideExpenseManager as any)._handler(ctx, {
      expenseId: "expense_owner",
      status: "Approved",
    });
    setIdentity("auth_finance");
    await (decideExpenseFinance as any)._handler(ctx, {
      expenseId: "expense_owner",
      status: "Approved",
    });

    expect(tables.expenseEntries[0]).toMatchObject({
      approvalStatus: "Approved",
      approvalVersion: 2,
      financeReviewStatus: "Approved",
      managerReviewStatus: "Approved",
    });
    setIdentity("auth_owner");
    await expect(
      (updateExpense as any)._handler(ctx, {
        category: "Forbidden final edit",
        expenseId: "expense_owner",
      })
    ).rejects.toThrow("Approved expenses cannot be edited");
  });
});
