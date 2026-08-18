const FORMULA_PREFIX_RE = /^[\t\n\r ]*[=+\-@]/;

function commitReportRow(row, index) {
  return {
    disposition: row.disposition,
    message: row.message ?? "",
    rowNumber: row.sourceRowNumber ?? index + 1,
    travellerName: row.fullName ?? "",
  };
}

/** Build per-row import reconciliation rows from commit rowResults or preview + batch errors. */
export function buildPassengerImportReportRows(previewRows, batches, rowResults) {
  if (rowResults?.length) {
    const committedById = new Map(rowResults.map((row) => [row.id, row]));
    const matchedIds = new Set();
    const reportRows = (previewRows ?? []).map((row, index) => {
      const committed = committedById.get(row.id);
      if (committed) {
        matchedIds.add(row.id);
        return commitReportRow(committed, index);
      }
      return {
        disposition: "replayed",
        message: "Completed before this resume",
        rowNumber: index + 1,
        travellerName: row.travellerName ?? "",
      };
    });
    for (const [index, row] of rowResults.entries()) {
      if (!matchedIds.has(row.id)) {
        reportRows.push(commitReportRow(row, index));
      }
    }
    return reportRows;
  }

  const errorById = new Map();
  for (const batch of batches ?? []) {
    for (const error of batch.errors ?? []) {
      errorById.set(error.id, error);
    }
  }

  return (previewRows ?? []).map((row, index) => {
    const error = errorById.get(row.id);
    if (error) {
      return {
        disposition: "failed",
        message: error.message,
        rowNumber: error.sourceRowNumber ?? index + 1,
        travellerName: row.travellerName ?? "",
      };
    }
    return {
      disposition: row.action === "update" ? "updated" : "created",
      message: "",
      rowNumber: index + 1,
      travellerName: row.travellerName ?? "",
    };
  });
}

export function passengerImportReportToCsv(rows) {
  const header = ["Row", "Traveller", "Disposition", "Message"];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [row.rowNumber, row.travellerName, row.disposition, row.message]
        .map((value) => {
          const text = String(value ?? "");
          // Spreadsheet clients may execute cells beginning with formula prefixes.
          // Prefixing the cell with an apostrophe keeps the value visible as text.
          const safeText = FORMULA_PREFIX_RE.test(text) ? `'${text}` : text;
          return `"${safeText.replace(/"/g, '""')}"`;
        })
        .join(",")
    ),
  ];
  return lines.join("\n");
}

export function downloadPassengerImportReportCsv(rows, filename = "import-reconciliation.csv") {
  const csv = passengerImportReportToCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
