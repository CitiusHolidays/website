/** Build per-row import reconciliation rows from commit rowResults or preview + batch errors. */
export function buildPassengerImportReportRows(previewRows, batches, rowResults) {
  if (rowResults?.length) {
    return rowResults.map((row, index) => ({
      disposition: row.disposition,
      message: row.message ?? "",
      rowNumber: row.sourceRowNumber ?? index + 1,
      travellerName: row.fullName ?? "",
    }));
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
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
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
