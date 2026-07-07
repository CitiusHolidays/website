import { describe, expect, test } from "bun:test";
import { parseStaffWorkbook, workbookFromSheets } from "./staffWorkbookImport";

describe("staff workbook import parsing", () => {
  test("parses leave approval matrix staff rows from workbook headers", () => {
    const workbook = workbookFromSheets({
      "Leave Approval Matrix": [
        [
          "S.no",
          "Name",
          "Email",
          "Mobile",
          "Job Role",
          "Department / Team",
          "Location",
          "Level 1 Approver",
          "Escalation (Level 2)",
          "Final Authority",
          "CC to HR",
          "Notes",
        ],
        [
          23,
          "Surajit Roy",
          "surajit@citius.in",
          "9831952974",
          "Finance HOD",
          "Finance Head",
          "Kolkata",
          "Kushmesh Chowdhury",
          "",
          "Surajit Roy",
          "Mithu Chatterjee",
          "Kolkata Accounts HOD / top authority",
        ],
      ],
    });

    const result = parseStaffWorkbook(workbook);
    expect(result.rows).toEqual([
      {
        departmentTeam: "Finance Head",
        email: "surajit@citius.in",
        escalationApproverName: "",
        finalAuthorityName: "Surajit Roy",
        hrCopyName: "Mithu Chatterjee",
        jobRole: "Finance HOD",
        level1ApproverName: "Kushmesh Chowdhury",
        location: "Kolkata",
        mobile: "9831952974",
        name: "Surajit Roy",
        notes: "Kolkata Accounts HOD / top authority",
        sourceRowNumber: 2,
        sourceSheet: "Leave Approval Matrix",
      },
    ]);
    expect(result.skipped).toEqual([]);
  });
});
