import { describe, expect, test } from "bun:test";
import {
  applyStaffWorkbookRowsForTest,
  buildStaffWorkbookPreviewForTest,
  resolveFinanceHeadStaff,
} from "./staffWorkbookUpdates";

type Row = { _id: string; [key: string]: unknown };
type Tables = Record<string, Row[]>;

function makeCtx(initialTables: Tables) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, [...rows]]),
  ) as Tables;

  const ctx = {
    db: {
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
          unique: async () => rows[0] ?? null,
          collect: async () => [...rows],
        };
      },
      get: async (id: string) => {
        for (const rows of Object.values(tables)) {
          const match = rows.find((row) => row._id === id);
          if (match) return match;
        }
        return null;
      },
      patch: async (id: string, patch: Record<string, unknown>) => {
        for (const [table, rows] of Object.entries(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            tables[table][index] = { ...rows[index], ...patch };
            return;
          }
        }
        throw new Error(`Missing row ${id}`);
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

describe("staff workbook updates", () => {
  test("previews changed staff workbook fields without applying them", async () => {
    const { ctx, tables } = makeCtx({
      staffUsers: [
        {
          _id: "staff_existing",
          email: "anamika@citius.in",
          emailNormalized: "anamika@citius.in",
          name: "Anamika Singh",
          roles: ["Sales"],
          function: "Sales",
          department: "Sales",
          mobile: "old",
          location: "Kolkata",
          active: true,
          createdAt: 1,
          updatedAt: 1,
        },
        {
          _id: "staff_approver",
          email: "olyvia@citius.in",
          emailNormalized: "olyvia@citius.in",
          name: "Olyvia Basuray",
          roles: ["Directors"],
          function: "Director",
          active: true,
          createdAt: 1,
          updatedAt: 1,
        },
        {
          _id: "staff_hr",
          email: "mithu@citius.in",
          emailNormalized: "mithu@citius.in",
          name: "Mithu Chatterjee",
          roles: ["HR"],
          function: "HR & Admin",
          active: true,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    const preview = await buildStaffWorkbookPreviewForTest(ctx as never, [
      {
        name: "Anamika Singh",
        email: "anamika@citius.in",
        mobile: "9686949608",
        jobRole: "Sales & Tour Manager",
        departmentTeam: "Sales",
        location: "Bangalore",
        level1ApproverName: "Olyvia Basuray",
        finalAuthorityName: "Olyvia Basuray",
        hrCopyName: "Mithu Chatterjee",
      },
    ]);

    expect(preview.summary).toEqual({ created: 0, updated: 1, unchanged: 0, skipped: 0 });
    expect(preview.rows[0]).toMatchObject({
      action: "updated",
      staffId: "staff_existing",
      emailNormalized: "anamika@citius.in",
      after: {
        mobile: "9686949608",
        function: "Sales & Tour Manager",
        department: "Sales",
        location: "Bangalore",
        leaveLevel1ApproverName: "Olyvia Basuray",
        leaveLevel1ApproverStaffId: "staff_approver",
        leaveFinalAuthorityName: "Olyvia Basuray",
        leaveFinalAuthorityStaffId: "staff_approver",
        leaveHrCopyName: "Mithu Chatterjee",
        leaveHrCopyStaffId: "staff_hr",
      },
    });
    expect(preview.rows[0]?.changes.map((change) => change.field)).toContain("mobile");
    expect(tables.staffUsers[0]?.mobile).toBe("old");
  });

  test("matches existing staff by normalized email when case differs and applies reviewed changes", async () => {
    const { ctx, tables } = makeCtx({
      staffUsers: [
        {
          _id: "staff_booking",
          email: "Booking@citius.in",
          emailNormalized: "booking@citius.in",
          name: "Suranjana Bhattacharji",
          roles: ["Sales"],
          function: "Sales",
          department: "FIT",
          active: true,
          createdAt: 1,
          updatedAt: 1,
        },
        {
          _id: "staff_rosy",
          email: "rosy@citius.in",
          emailNormalized: "rosy@citius.in",
          name: "Rosy Mitra",
          roles: ["Directors"],
          function: "Director",
          active: true,
          createdAt: 1,
          updatedAt: 1,
        },
        {
          _id: "staff_hr",
          email: "mithu@citius.in",
          emailNormalized: "mithu@citius.in",
          name: "Mithu Chatterjee",
          roles: ["HR"],
          function: "HR & Admin",
          active: true,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    const preview = await buildStaffWorkbookPreviewForTest(ctx as never, [
      {
        name: "Suranjana Bhattacharji",
        email: "booking@citius.in",
        mobile: "9038765012",
        jobRole: "Sales, Contracting , Operation & Tour Manager",
        departmentTeam: "FIT",
        location: "Kolkata",
        level1ApproverName: "Rosy Mitra",
        finalAuthorityName: "Rosy Mitra",
        hrCopyName: "Mithu Chatterjee",
      },
    ]);
    expect(preview.rows[0]).toMatchObject({ action: "updated", staffId: "staff_booking" });

    const result = await applyStaffWorkbookRowsForTest(ctx as never, {
      rows: [
        {
          name: "Suranjana Bhattacharji",
          email: "booking@citius.in",
          mobile: "9038765012",
          jobRole: "Sales, Contracting , Operation & Tour Manager",
          departmentTeam: "FIT",
          location: "Kolkata",
          level1ApproverName: "Rosy Mitra",
          finalAuthorityName: "Rosy Mitra",
          hrCopyName: "Mithu Chatterjee",
        },
      ],
      now: 42,
    });

    expect(result.summary).toEqual({ created: 0, updated: 1, unchanged: 0, skipped: 0 });
    expect(tables.staffUsers).toHaveLength(3);
    expect(tables.staffUsers[0]).toMatchObject({
      _id: "staff_booking",
      email: "booking@citius.in",
      emailNormalized: "booking@citius.in",
      mobile: "9038765012",
      roles: ["Sales", "Contracting", "Operations", "Tour Manager"],
      function: "Sales, Contracting, Operation & Tour Manager",
      leaveLevel1ApproverStaffId: "staff_rosy",
      leaveFinalAuthorityStaffId: "staff_rosy",
      leaveHrCopyStaffId: "staff_hr",
      updatedAt: 42,
    });
  });

  test("creates new staff records and resolves same-workbook approver references after apply", async () => {
    const { ctx, tables } = makeCtx({ staffUsers: [] });

    const result = await applyStaffWorkbookRowsForTest(ctx as never, {
      rows: [
        {
          name: "Olyvia Basuray",
          email: "olyvia@citius.in",
          jobRole: "Director",
          departmentTeam: "Overall Admin and Approvals",
          location: "Bangalore",
          level1ApproverName: "Self",
          finalAuthorityName: "Olyvia Basuray",
          hrCopyName: "Mithu Chatterjee",
        },
        {
          name: "Mithu Chatterjee",
          email: "mithu@citius.in",
          jobRole: "HR & Admin",
          departmentTeam: "HR & Admin",
          location: "Kolkata",
          level1ApproverName: "Olyvia Basuray",
          finalAuthorityName: "Olyvia Basuray",
          hrCopyName: "Mithu Chatterjee",
        },
      ],
      now: 84,
    });

    expect(result.summary).toEqual({ created: 2, updated: 0, unchanged: 0, skipped: 0 });
    expect(tables.staffUsers[0]).toMatchObject({
      emailNormalized: "olyvia@citius.in",
      leaveLevel1ApproverStaffId: "staffUsers_1",
      leaveFinalAuthorityStaffId: "staffUsers_1",
      leaveHrCopyStaffId: "staffUsers_2",
      invitedBy: "staff-workbook",
      pendingPasswordSetup: true,
    });
    expect(tables.staffUsers[1]).toMatchObject({
      emailNormalized: "mithu@citius.in",
      leaveLevel1ApproverStaffId: "staffUsers_1",
      leaveHrCopyStaffId: "staffUsers_2",
    });
  });

  test("resolves Finance Head from the canonical staff job role", () => {
    const financeHead = resolveFinanceHeadStaff([
      {
        _id: "staff_accounts",
        name: "Accounts User",
        email: "accounts@citius.in",
        active: true,
        function: "Accounts",
      },
      {
        _id: "staff_finance",
        name: "Surajit Roy",
        email: "surajit@citius.in",
        active: true,
        function: "Finance Head",
      },
    ]);

    expect(financeHead?._id).toBe("staff_finance");
  });

  test("skips duplicate normalized workbook emails instead of creating conflicting accounts", async () => {
    const { ctx } = makeCtx({ staffUsers: [] });

    const preview = await buildStaffWorkbookPreviewForTest(ctx as never, [
      {
        name: "Shreenidhi Roy",
        email: "bookings@citius.in",
        jobRole: "Operations - Cement",
        departmentTeam: "Operations",
      },
      {
        name: "Suranjana Bhattacharji",
        email: "Bookings@citius.in",
        jobRole: "Sales, Contracting, Operation & Tour Manager",
        departmentTeam: "FIT",
      },
    ]);

    expect(preview.summary).toEqual({ created: 0, updated: 0, unchanged: 0, skipped: 2 });
    expect(preview.rows).toEqual([
      expect.objectContaining({
        action: "skipped",
        emailNormalized: "bookings@citius.in",
        message: "Duplicate staff email in workbook; review before applying",
      }),
      expect.objectContaining({
        action: "skipped",
        emailNormalized: "bookings@citius.in",
        message: "Duplicate staff email in workbook; review before applying",
      }),
    ]);
  });

  test("infers head roles from workbook department labels", async () => {
    const { ctx } = makeCtx({ staffUsers: [] });

    const preview = await buildStaffWorkbookPreviewForTest(ctx as never, [
      {
        name: "Monika Sarang Karnik",
        email: "monika@citius.in",
        jobRole: "General Manager - MICE Operations",
        departmentTeam: "Contracting & Operations Head",
      },
      {
        name: "Vicky Shaw",
        email: "vicky@citius.in",
        jobRole: "Sales, Operation, Tour Manager",
        departmentTeam: "Operation Head - MICE",
      },
    ]);

    expect(preview.rows[0]?.after.roles).toEqual([
      "Contracting",
      "Contracting Head",
      "Operations",
      "Operations Head",
    ]);
    expect(preview.rows[1]?.after.roles).toEqual([
      "Sales",
      "Operations",
      "Operations Head",
      "Tour Manager",
    ]);
  });
});
