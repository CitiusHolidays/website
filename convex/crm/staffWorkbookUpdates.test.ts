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
    Object.entries(initialTables).map(([table, rows]) => [table, [...rows]])
  ) as Tables;

  const ctx = {
    db: {
      get: async (id: string) => {
        for (const rows of Object.values(tables)) {
          const match = rows.find((row) => row._id === id);
          if (match) {
            return match;
          }
        }
        return null;
      },
      insert: async (tableName: string, doc: Record<string, unknown>) => {
        const id = `${tableName}_${(tables[tableName]?.length ?? 0) + 1}`;
        const row = { _id: id, ...doc };
        tables[tableName] = [...(tables[tableName] ?? []), row];
        return id;
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
      query(tableName: string) {
        let rows = tables[tableName] ?? [];
        return {
          collect: async () => [...rows],
          unique: async () => rows[0] ?? null,
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
              filters.every((filter) => row[filter.field] === filter.value)
            );
            return this;
          },
        };
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
          active: true,
          createdAt: 1,
          department: "Sales",
          email: "anamika@citius.in",
          emailNormalized: "anamika@citius.in",
          function: "Sales",
          location: "Kolkata",
          mobile: "old",
          name: "Anamika Singh",
          roles: ["Sales"],
          updatedAt: 1,
        },
        {
          _id: "staff_approver",
          active: true,
          createdAt: 1,
          email: "olyvia@citius.in",
          emailNormalized: "olyvia@citius.in",
          function: "Director",
          name: "Olyvia Basuray",
          roles: ["Directors"],
          updatedAt: 1,
        },
        {
          _id: "staff_hr",
          active: true,
          createdAt: 1,
          email: "mithu@citius.in",
          emailNormalized: "mithu@citius.in",
          function: "HR & Admin",
          name: "Mithu Chatterjee",
          roles: ["HR"],
          updatedAt: 1,
        },
      ],
    });

    const preview = await buildStaffWorkbookPreviewForTest(ctx as never, [
      {
        departmentTeam: "Sales",
        email: "anamika@citius.in",
        finalAuthorityName: "Olyvia Basuray",
        hrCopyName: "Mithu Chatterjee",
        jobRole: "Sales & Tour Manager",
        level1ApproverName: "Olyvia Basuray",
        location: "Bangalore",
        mobile: "9686949608",
        name: "Anamika Singh",
      },
    ]);

    expect(preview.summary).toEqual({ created: 0, skipped: 0, unchanged: 0, updated: 1 });
    expect(preview.rows[0]).toMatchObject({
      action: "updated",
      after: {
        department: "Sales",
        function: "Sales & Tour Manager",
        leaveFinalAuthorityName: "Olyvia Basuray",
        leaveFinalAuthorityStaffId: "staff_approver",
        leaveHrCopyName: "Mithu Chatterjee",
        leaveHrCopyStaffId: "staff_hr",
        leaveLevel1ApproverName: "Olyvia Basuray",
        leaveLevel1ApproverStaffId: "staff_approver",
        location: "Bangalore",
        mobile: "9686949608",
      },
      emailNormalized: "anamika@citius.in",
      staffId: "staff_existing",
    });
    expect(preview.rows[0]?.changes.map((change) => change.field)).toContain("mobile");
    expect(tables.staffUsers[0]?.mobile).toBe("old");
  });

  test("matches existing staff by normalized email when case differs and applies reviewed changes", async () => {
    const { ctx, tables } = makeCtx({
      staffUsers: [
        {
          _id: "staff_booking",
          active: true,
          createdAt: 1,
          department: "FIT",
          email: "Booking@citius.in",
          emailNormalized: "booking@citius.in",
          function: "Sales",
          name: "Suranjana Bhattacharji",
          roles: ["Sales"],
          updatedAt: 1,
        },
        {
          _id: "staff_rosy",
          active: true,
          createdAt: 1,
          email: "rosy@citius.in",
          emailNormalized: "rosy@citius.in",
          function: "Director",
          name: "Rosy Mitra",
          roles: ["Directors"],
          updatedAt: 1,
        },
        {
          _id: "staff_hr",
          active: true,
          createdAt: 1,
          email: "mithu@citius.in",
          emailNormalized: "mithu@citius.in",
          function: "HR & Admin",
          name: "Mithu Chatterjee",
          roles: ["HR"],
          updatedAt: 1,
        },
      ],
    });

    const preview = await buildStaffWorkbookPreviewForTest(ctx as never, [
      {
        departmentTeam: "FIT",
        email: "booking@citius.in",
        finalAuthorityName: "Rosy Mitra",
        hrCopyName: "Mithu Chatterjee",
        jobRole: "Sales, Contracting , Operation & Tour Manager",
        level1ApproverName: "Rosy Mitra",
        location: "Kolkata",
        mobile: "9038765012",
        name: "Suranjana Bhattacharji",
      },
    ]);
    expect(preview.rows[0]).toMatchObject({ action: "updated", staffId: "staff_booking" });

    const result = await applyStaffWorkbookRowsForTest(ctx as never, {
      now: 42,
      rows: [
        {
          departmentTeam: "FIT",
          email: "booking@citius.in",
          finalAuthorityName: "Rosy Mitra",
          hrCopyName: "Mithu Chatterjee",
          jobRole: "Sales, Contracting , Operation & Tour Manager",
          level1ApproverName: "Rosy Mitra",
          location: "Kolkata",
          mobile: "9038765012",
          name: "Suranjana Bhattacharji",
        },
      ],
    });

    expect(result.summary).toEqual({ created: 0, skipped: 0, unchanged: 0, updated: 1 });
    expect(tables.staffUsers).toHaveLength(3);
    expect(tables.staffUsers[0]).toMatchObject({
      _id: "staff_booking",
      email: "booking@citius.in",
      emailNormalized: "booking@citius.in",
      function: "Sales, Contracting, Operation & Tour Manager",
      leaveFinalAuthorityStaffId: "staff_rosy",
      leaveHrCopyStaffId: "staff_hr",
      leaveLevel1ApproverStaffId: "staff_rosy",
      mobile: "9038765012",
      roles: ["Sales", "Contracting", "Operations", "Tour Manager"],
      updatedAt: 42,
    });
  });

  test("creates new staff records and resolves same-workbook approver references after apply", async () => {
    const { ctx, tables } = makeCtx({ staffUsers: [] });

    const result = await applyStaffWorkbookRowsForTest(ctx as never, {
      now: 84,
      rows: [
        {
          departmentTeam: "Overall Admin and Approvals",
          email: "olyvia@citius.in",
          finalAuthorityName: "Olyvia Basuray",
          hrCopyName: "Mithu Chatterjee",
          jobRole: "Director",
          level1ApproverName: "Self",
          location: "Bangalore",
          name: "Olyvia Basuray",
        },
        {
          departmentTeam: "HR & Admin",
          email: "mithu@citius.in",
          finalAuthorityName: "Olyvia Basuray",
          hrCopyName: "Mithu Chatterjee",
          jobRole: "HR & Admin",
          level1ApproverName: "Olyvia Basuray",
          location: "Kolkata",
          name: "Mithu Chatterjee",
        },
      ],
    });

    expect(result.summary).toEqual({ created: 2, skipped: 0, unchanged: 0, updated: 0 });
    expect(tables.staffUsers[0]).toMatchObject({
      emailNormalized: "olyvia@citius.in",
      invitedBy: "staff-workbook",
      leaveFinalAuthorityStaffId: "staffUsers_1",
      leaveHrCopyStaffId: "staffUsers_2",
      leaveLevel1ApproverStaffId: "staffUsers_1",
      pendingPasswordSetup: true,
    });
    expect(tables.staffUsers[1]).toMatchObject({
      emailNormalized: "mithu@citius.in",
      leaveHrCopyStaffId: "staffUsers_2",
      leaveLevel1ApproverStaffId: "staffUsers_1",
    });
  });

  test("resolves Finance Head from the canonical staff job role", () => {
    const financeHead = resolveFinanceHeadStaff([
      {
        _id: "staff_accounts",
        active: true,
        email: "accounts@citius.in",
        function: "Accounts",
        name: "Accounts User",
      },
      {
        _id: "staff_finance",
        active: true,
        email: "surajit@citius.in",
        function: "Finance Head",
        name: "Surajit Roy",
      },
    ]);

    expect(financeHead?._id).toBe("staff_finance");
  });

  test("skips duplicate normalized workbook emails instead of creating conflicting accounts", async () => {
    const { ctx } = makeCtx({ staffUsers: [] });

    const preview = await buildStaffWorkbookPreviewForTest(ctx as never, [
      {
        departmentTeam: "Operations",
        email: "bookings@citius.in",
        jobRole: "Operations - Cement",
        name: "Shreenidhi Roy",
      },
      {
        departmentTeam: "FIT",
        email: "Bookings@citius.in",
        jobRole: "Sales, Contracting, Operation & Tour Manager",
        name: "Suranjana Bhattacharji",
      },
    ]);

    expect(preview.summary).toEqual({ created: 0, skipped: 2, unchanged: 0, updated: 0 });
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
        departmentTeam: "Contracting & Operations Head",
        email: "monika@citius.in",
        jobRole: "General Manager - MICE Operations",
        name: "Monika Sarang Karnik",
      },
      {
        departmentTeam: "Operation Head - MICE",
        email: "vicky@citius.in",
        jobRole: "Sales, Operation, Tour Manager",
        name: "Vicky Shaw",
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
