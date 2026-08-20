import { describe, expect, test } from "bun:test";
import type { RuntimeValue } from "../lib/runtimeValues";
import { listStaff } from "./staff";

interface StaffRow {
  _id: string;
  active: boolean;
  authUserId?: string;
  createdAt: number;
  email: string;
  emailNormalized: string;
  name: string;
  roles: string[];
  updatedAt: number;
  [key: string]: RuntimeValue;
}

function makeStaffListCtx(sourceRows: StaffRow[]) {
  const ctx = {
    auth: {
      getUserIdentity: async () => ({
        email: "admin@example.com",
        subject: "auth_admin",
        tokenIdentifier: "auth_admin",
      }),
    },
    db: {
      get: (_table: string, id: string) => {
        const row = sourceRows.find((candidate) => candidate._id === id);
        if (!row) {
          throw new Error(`Invalid ID ${String(id)}`);
        }
        return Promise.resolve(row);
      },
      normalizeId: (_table: string, id: string) =>
        sourceRows.some((row) => row._id === id) ? id : null,
      query(table: string) {
        if (table !== "staffUsers") {
          throw new Error(`Unexpected table ${table}`);
        }
        let rows = [...sourceRows];
        const builder = {
          filter(predicate: (q: any) => (row: StaffRow) => boolean) {
            const expression = predicate({
              and:
                (...predicates: Array<(row: StaffRow) => boolean>) =>
                (row: StaffRow) =>
                  predicates.every((candidate) => candidate(row)),
              eq: (field: string, value: RuntimeValue) => (row: StaffRow) => row[field] === value,
              field: (field: string) => field,
              gte: (field: string, value: number) => (row: StaffRow) => Number(row[field]) >= value,
              lte: (field: string, value: number) => (row: StaffRow) => Number(row[field]) <= value,
            });
            rows = rows.filter(expression);
            return builder;
          },
          order(direction: "asc" | "desc") {
            rows.sort((left, right) => left.name.localeCompare(right.name));
            if (direction === "desc") {
              rows.reverse();
            }
            return builder;
          },
          paginate({ cursor, numItems }: { cursor: string | null; numItems: number }) {
            const start = cursor ? Number.parseInt(cursor, 10) : 0;
            const page = rows.slice(start, start + numItems);
            const next = start + page.length;
            return Promise.resolve({
              continueCursor: next < rows.length ? String(next) : "",
              isDone: next >= rows.length,
              page,
            });
          },
          take(count: number) {
            return Promise.resolve(rows.slice(0, count));
          },
          withIndex(
            _indexName: string,
            callback?: (q: {
              eq: (field: string, value: RuntimeValue) => RuntimeValue;
            }) => RuntimeValue
          ) {
            if (callback) {
              const equalities: Array<{ field: string; value: unknown }> = [];
              const q = {
                eq(field: string, value: RuntimeValue) {
                  equalities.push({ field, value });
                  return q;
                },
              };
              callback(q);
              rows = rows.filter((row) =>
                equalities.every(({ field, value }) => row[field] === value)
              );
            }
            return builder;
          },
        };
        return builder;
      },
    },
  };
  return ctx;
}

const staffRows: StaffRow[] = [
  {
    _id: "staff_admin",
    active: true,
    authUserId: "auth_admin",
    createdAt: 1,
    email: "admin@example.com",
    emailNormalized: "admin@example.com",
    name: "Admin User",
    roles: ["Admin"],
    updatedAt: 1,
  },
  ...Array.from({ length: 5 }, (_, index) => ({
    _id: `staff_inactive_${index}`,
    active: false,
    createdAt: index + 2,
    email: `inactive-${index}@example.com`,
    emailNormalized: `inactive-${index}@example.com`,
    name: `Inactive ${index}`,
    roles: ["Sales"],
    updatedAt: index + 2,
  })),
];

describe("Settings staff cursor filters", () => {
  test("Keeps active false applied across every cursor page", async () => {
    const ctx = makeStaffListCtx(staffRows);
    const loaded: Array<{ active: boolean; name: string }> = [];
    const loadPage = async (cursor: string | null): Promise<void> => {
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const result = await (listStaff as any)._handler(ctx, {
        active: false,
        paginationOpts: { cursor, numItems: 2 },
      });
      loaded.push(...result.page);
      if (!result.isDone) {
        await loadPage(result.continueCursor);
      }
    };
    await loadPage(null);

    expect(loaded).toHaveLength(5);
    expect(loaded.every((row) => row.active === false)).toBe(true);
    expect(loaded.map((row) => row.name)).toEqual([
      "Inactive 0",
      "Inactive 1",
      "Inactive 2",
      "Inactive 3",
      "Inactive 4",
    ]);
  });

  test("Retains active true and undefined behavior", async () => {
    const ctx = makeStaffListCtx(staffRows);
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const activePage = await (listStaff as any)._handler(ctx, {
      active: true,
      paginationOpts: { cursor: null, numItems: 100 },
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const unfilteredPage = await (listStaff as any)._handler(ctx, {
      active: undefined,
      paginationOpts: { cursor: null, numItems: 100 },
    });

    expect(activePage.page.map((row: { name: string }) => row.name)).toEqual(["Admin User"]);
    expect(unfilteredPage.page).toHaveLength(6);
  });

  test("Skips malformed legacy leave approver references instead of crashing the staff list", async () => {
    const ctx = makeStaffListCtx([
      ...staffRows,
      {
        _id: "staff_legacy",
        active: true,
        createdAt: 10,
        email: "legacy@example.com",
        emailNormalized: "legacy@example.com",
        leaveHeadApproverId: "staff_head",
        name: "Legacy Staff",
        roles: ["Sales"],
        updatedAt: 10,
      },
    ]);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await (listStaff as any)._handler(ctx, {
      active: true,
      paginationOpts: { cursor: null, numItems: 100 },
    });

    expect(result.page.find((row: { name: string }) => row.name === "Legacy Staff")).toMatchObject({
      leaveHeadApproverId: "staff_head",
      leaveHeadApproverName: "",
    });
  });
});
