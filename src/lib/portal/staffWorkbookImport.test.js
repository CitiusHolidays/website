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
        sourceSheet: "Leave Approval Matrix",
        sourceRowNumber: 2,
        name: "Surajit Roy",
        email: "surajit@citius.in",
        mobile: "9831952974",
        jobRole: "Finance HOD",
        departmentTeam: "Finance Head",
        location: "Kolkata",
        level1ApproverName: "Kushmesh Chowdhury",
        escalationApproverName: "",
        finalAuthorityName: "Surajit Roy",
        hrCopyName: "Mithu Chatterjee",
        notes: "Kolkata Accounts HOD / top authority",
      },
    ]);
    expect(result.skipped).toEqual([]);
  });
});
