import { workbookFromSheets, workbookRowsFromArrayBuffer } from "./workbookAdapter";

export { workbookFromSheets };

const REQUIRED_HEADERS = ["Name", "Email"];

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function headerKey(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function rowToHeaderMap(row) {
  const map = new Map();
  row.forEach((cell, index) => {
    const key = headerKey(cell);
    if (key && !map.has(key)) {
      map.set(key, index);
    }
  });
  return map;
}

function getByHeader(row, headers, names) {
  for (const name of names) {
    const index = headers.get(headerKey(name));
    if (index !== undefined) {
      return clean(row[index]);
    }
  }
  return "";
}

function hasRequiredHeaders(headers) {
  return REQUIRED_HEADERS.every((header) => headers.has(headerKey(header)));
}

function staffSheetEntries(workbook) {
  return Object.entries(workbook.Sheets ?? {}).flatMap(([sheetName, rows]) =>
    (rows ?? []).map((row, index) => ({ row, rowNumber: index + 1, sheetName }))
  );
}

export async function parseStaffWorkbookFile(file) {
  return parseStaffWorkbook(await workbookRowsFromArrayBuffer(await file.arrayBuffer()));
}

export function parseStaffWorkbook(workbook) {
  const skipped = [];
  const rows = [];
  const entries = staffSheetEntries(workbook);
  let activeHeaders = null;
  let activeSheet = "";

  for (const entry of entries) {
    const headerCandidate = rowToHeaderMap(entry.row);
    if (hasRequiredHeaders(headerCandidate) && headerCandidate.has(headerKey("Job Role"))) {
      activeHeaders = headerCandidate;
      activeSheet = entry.sheetName;
      continue;
    }

    if (!activeHeaders || activeSheet !== entry.sheetName) {
      continue;
    }

    const name = getByHeader(entry.row, activeHeaders, ["Name", "Employee Name"]);
    const email = getByHeader(entry.row, activeHeaders, ["Email", "Email ID", "Email Id"]);
    if (!(name || email)) {
      continue;
    }
    if (!(name && email)) {
      skipped.push({
        id: `${entry.sheetName}:${entry.rowNumber}`,
        reason: "Missing staff name or email",
        sourceRowNumber: entry.rowNumber,
        sourceSheet: entry.sheetName,
      });
      continue;
    }

    rows.push({
      departmentTeam: getByHeader(entry.row, activeHeaders, [
        "Department / Team",
        "Department",
        "Team",
      ]),
      email,
      escalationApproverName: getByHeader(entry.row, activeHeaders, [
        "Escalation (Level 2)",
        "Level 2 Approver",
      ]),
      finalAuthorityName: getByHeader(entry.row, activeHeaders, ["Final Authority"]),
      hrCopyName: getByHeader(entry.row, activeHeaders, ["CC to HR", "HR Copy", "Copy to HR"]),
      jobRole: getByHeader(entry.row, activeHeaders, ["Job Role", "Role"]),
      level1ApproverName: getByHeader(entry.row, activeHeaders, [
        "Level 1 Approver",
        "Leave Application Alert",
      ]),
      location: getByHeader(entry.row, activeHeaders, ["Location", "Base Location"]),
      mobile: getByHeader(entry.row, activeHeaders, ["Mobile", "Mobile No", "Contact No."]),
      name,
      notes: getByHeader(entry.row, activeHeaders, ["Notes", "Remarks"]),
      sourceRowNumber: entry.rowNumber,
      sourceSheet: entry.sheetName,
    });
  }

  return { rows, skipped };
}
