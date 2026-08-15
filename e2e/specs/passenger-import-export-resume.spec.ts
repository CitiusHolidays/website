import { Buffer } from "node:buffer";
import { expect, type Locator, type Page, test } from "@playwright/test";
import ExcelJS from "exceljs";
import { openPortalAs } from "../helpers/auth";
import { selectOptionByMatchingLabel } from "../helpers/select";
import { E2E_SKIP_REASON, hasE2eCredentials } from "../helpers/skip";

const JOB_CODE = "JC-E2E-WORKFLOW-EO";
const ROW_COUNT = 120;

async function passengerWorkbook(runSuffix: string) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Passengers");
  worksheet.addRow([
    "SURNAME",
    "Name As per Govt. ID Proof",
    "Passport no ",
    "Contact No.",
    "Meal Preference",
  ]);
  for (let index = 1; index <= ROW_COUNT; index += 1) {
    worksheet.addRow([
      `P153-${runSuffix}`,
      `Passenger ${String(index).padStart(3, "0")}`,
      "",
      `555${runSuffix.slice(-4)}${String(index).padStart(3, "0")}`,
      "VEG",
    ]);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function spreadsheetDialog(page: Page, name: string) {
  return page.getByRole("dialog", { name });
}

async function openTicketingListAction(
  page: Page,
  action: "Export Passengers" | "Import Passengers"
) {
  const toolbar = page.getByTestId("portal-list-toolbar-actions");
  await toolbar.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { exact: true, name: action }).click();
}

async function chooseWorkflowJob(dialog: Locator) {
  await selectOptionByMatchingLabel(dialog.getByLabel("Job Card"), JOB_CODE);
}

async function uploadWorkbook(dialog: Locator, workbook: Buffer, fileName: string) {
  await dialog.locator('input[type="file"]').setInputFiles({
    buffer: workbook,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    name: fileName,
  });
  await expect(dialog.getByText(String(ROW_COUNT), { exact: true }).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(dialog.getByRole("button", { name: "Upload Ticketing List" })).toBeEnabled({
    timeout: 30_000,
  });
}

test.describe("@workflow passenger import and export resume", () => {
  test.skip(!hasE2eCredentials(), E2E_SKIP_REASON);

  test("passenger import resumes after navigation and export continues after closing", async ({
    browser,
  }) => {
    test.setTimeout(360_000);
    const runSuffix = String(Date.now());
    const sampleName = `Passenger 001 P153-${runSuffix}`;
    const fileName = `e2e-p153-${runSuffix}.xlsx`;
    const workbook = await passengerWorkbook(runSuffix);
    const { context, page } = await openPortalAs(browser, "ticketing");

    await page.goto("/portal/ticketing");
    await openTicketingListAction(page, "Import Passengers");
    let importDialog = spreadsheetDialog(page, "Import Ticketing Passenger List");
    await chooseWorkflowJob(importDialog);
    await uploadWorkbook(importDialog, workbook, fileName);
    await importDialog.getByRole("button", { name: "Upload Ticketing List" }).click();

    await expect(importDialog.getByTestId("passenger-import-batch-progress")).toHaveText(
      "1 of 3 batches complete",
      { timeout: 60_000 }
    );
    await page.reload({ waitUntil: "domcontentloaded" });

    await openTicketingListAction(page, "Import Passengers");
    importDialog = spreadsheetDialog(page, "Import Ticketing Passenger List");
    await expect(importDialog.getByText(/[12] of 3 batches complete/)).toBeVisible({
      timeout: 30_000,
    });
    await chooseWorkflowJob(importDialog);
    await uploadWorkbook(importDialog, workbook, fileName);
    await importDialog.getByRole("button", { name: "Upload Ticketing List" }).click();

    const reconciliation = spreadsheetDialog(page, "Import reconciliation");
    await expect(reconciliation).toContainText("Created 120, updated 0, failed 0 of 120", {
      timeout: 90_000,
    });
    await expect(reconciliation.getByText(sampleName, { exact: true })).toBeVisible();
    await reconciliation.getByRole("button", { name: "Done" }).click();

    await openTicketingListAction(page, "Export Passengers");
    let exportDialog = spreadsheetDialog(page, "Export Ticketing Passenger List");
    await chooseWorkflowJob(exportDialog);
    await exportDialog.getByRole("button", { name: "Generate Spreadsheet" }).click();
    await expect(
      exportDialog.getByText(/You can close this dialog; processing will continue/)
    ).toBeVisible({
      timeout: 30_000,
    });
    await exportDialog.getByRole("button", { name: "Cancel" }).click();

    await openTicketingListAction(page, "Export Passengers");
    exportDialog = spreadsheetDialog(page, "Export Ticketing Passenger List");
    await chooseWorkflowJob(exportDialog);
    await expect(exportDialog.getByText(`${ROW_COUNT} rows are ready to download.`)).toBeVisible({
      timeout: 90_000,
    });

    const downloadPromise = page.waitForEvent("download");
    await exportDialog.getByRole("button", { name: "Download Spreadsheet" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${JOB_CODE}-ticketing-passengers.xlsx`);
    const downloadedPath = await download.path();
    expect(downloadedPath).not.toBeNull();

    const exportedWorkbook = new ExcelJS.Workbook();
    await exportedWorkbook.xlsx.readFile(downloadedPath!);
    const exportedSheet = exportedWorkbook.getWorksheet("Passengers");
    expect(exportedSheet?.actualRowCount).toBe(ROW_COUNT + 1);
    expect(exportedSheet?.getRow(2).getCell(3).text).toBe(`P153-${runSuffix}`);
    expect(exportedSheet?.getRow(2).getCell(4).text).toBe("Passenger 001");

    await context.close();
  });
});
