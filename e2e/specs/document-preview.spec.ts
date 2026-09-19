import { type Browser, expect, type Locator, type Page, test } from "@playwright/test";
import {
  DOCUMENT_PREVIEW_FORMATS,
  hostileOfficeFixture,
  type PreviewCorpusFixture,
  previewCorpusFixture,
  previewRasterFixtures,
} from "../fixtures/documentPreviewCorpus";
import { openPortalAs } from "../helpers/auth";
import { uniqueE2eLabel } from "../helpers/chainState";
import { holdToConfirmDelete } from "../helpers/confirm";
import { fillPortalDate, isoDate } from "../helpers/date";
import { entityModal, modalField, saveEntityModal } from "../helpers/modal";
import { selectOptionByMatchingLabel } from "../helpers/select";
import { E2E_SKIP_REASON, hasE2eCredentials } from "../helpers/skip";
import { portalPages } from "../pages";

const { ProposalsPage, QueriesPage, TravellersPage } = portalPages;

function viewer(page: Page) {
  return page
    .getByRole("dialog")
    .filter({ has: page.getByRole("button", { name: "Close document preview" }) });
}

function commercialFiles(page: Page) {
  return page.getByRole("dialog", { exact: true, name: "Commercial Files" });
}

function commercialCard(page: Page, name: string) {
  return commercialFiles(page)
    .getByText(name, { exact: true })
    .locator(
      "xpath=ancestor::div[.//button[normalize-space()='View' or normalize-space()='Restore']][1]"
    );
}

async function closePreview(page: Page, opener?: Locator) {
  await viewer(page).getByRole("button", { name: "Close document preview" }).click();
  await expect(viewer(page)).toBeHidden();
  if (opener) {
    await expect(opener).toBeFocused();
  }
}

async function assertRendered(page: Page, fixture: PreviewCorpusFixture) {
  const preview = viewer(page);
  await expect(preview.getByRole("heading", { exact: true, name: fixture.name })).toBeVisible();
  if (fixture.format === "image") {
    await expect
      .poll(() =>
        preview
          .locator("img")
          .evaluateAll((images) =>
            images.some(
              (image) =>
                image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0
            )
          )
      )
      .toBe(true);
    await preview.getByRole("button", { name: "Rotate clockwise" }).click();
  } else if (fixture.format === "text") {
    await expect(preview.getByText("Day 1: Delhi", { exact: false })).toBeVisible();
  } else {
    await expect(preview.locator("canvas").first()).toBeVisible();
    await expect(preview.getByRole("article")).toContainText("Preview fixture");
    await preview.getByRole("button", { exact: true, name: "Zoom in" }).click();
    await preview.getByRole("button", { exact: true, name: "Fit width" }).click();
    if (fixture.format === "xlsx") {
      await expect(preview.getByRole("table", { name: "Costs values" })).toContainText("60");
      await expect(
        preview.getByRole("region", { name: "Formula calculation status" })
      ).toContainText(/not recalculated in preview/i);
    }
  }
  if (fixture.format !== "image") {
    await preview.getByRole("textbox", { name: "Search this document" }).fill("Preview fixture");
    await preview.getByRole("button", { exact: true, name: "Find" }).click();
    await expect(preview.getByText(/1 of \d+ match/)).toBeVisible();
  }
}

async function createCommercialFiles(page: Page, fixtures: PreviewCorpusFixture[]) {
  const clientName = uniqueE2eLabel("E2E Preview Query");
  const queries = new QueriesPage(page);
  await queries.open();
  await queries.createQuery(clientName);
  await saveEntityModal(page);
  const row = queries.queryRow(clientName);
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /More actions for/ }).click();
  await page.getByRole("menuitem", { exact: true, name: "Files" }).click();
  const files = commercialFiles(page);
  await expect(files).toBeVisible();
  await files.getByLabel("Choose files", { exact: true }).setInputFiles(fixtures);
  await files.getByRole("button", { exact: true, name: "Upload files" }).click();
  await expect(files.getByRole("button", { exact: true, name: "Upload files" })).toBeDisabled();
  await expect(
    commercialCard(page, fixtures[0].name).getByRole("button", { exact: true, name: "View" })
  ).toBeVisible();
  return { clientName, row };
}

async function explicitDownload(page: Page, fixture: PreviewCorpusFixture) {
  const downloadReady = page.waitForEvent("download");
  await viewer(page).getByRole("link", { exact: true, name: "Download" }).click();
  const download = await downloadReady;
  expect(download.suggestedFilename()).toBe(fixture.name);
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream();
  if (!stream) {
    throw new Error("Explicit Download returned no source bytes");
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  expect(Buffer.concat(chunks).equals(fixture.buffer)).toBe(true);
}

async function assertDenied(browser: Browser, sourceUrl: string) {
  const denied = await openPortalAs(browser, "hr");
  try {
    const response = await denied.page.request.get(`${sourceUrl}?mode=preview`);
    expect([401, 403, 404]).toContain(response.status());
    expect(await response.text()).not.toContain("Preview fixture");
    await denied.page.goto(`/portal?preview=${encodeURIComponent(sourceUrl)}`);
    await expect(
      viewer(denied.page).getByRole("alert", { name: "Document preview error" })
    ).toBeVisible();
    await expect(viewer(denied.page).locator("canvas, img, article")).toHaveCount(0);
  } finally {
    await denied.context.close();
  }
}

// Source-owned journeys use the existing strict setup and ownership-ledger teardown. No test
// provisions a target or changes rollout/worker settings; omitted credentials stay an explicit skip.
test.describe("@workflow Document Preview", () => {
  test.skip(!hasE2eCredentials(), E2E_SKIP_REASON);
  test.setTimeout(180_000);

  test("[document-preview-formats] Sales views the current format corpus with explicit downloads and restored context", async ({
    browser,
  }) => {
    const { context, page } = await openPortalAs(browser, "sales");
    try {
      const fixtures = [
        ...DOCUMENT_PREVIEW_FORMATS.map((format) => previewCorpusFixture(format)),
        ...previewRasterFixtures().filter((fixture) => fixture.mimeType !== "image/png"),
      ];
      await createCommercialFiles(page, fixtures);
      let forbiddenRequests = 0;
      await context.route("https://document-preview.invalid/**", async (route) => {
        forbiddenRequests += 1;
        await route.abort();
      });
      let downloads = 0;
      page.on("download", () => {
        downloads += 1;
      });
      for (const fixture of fixtures) {
        await test.step(`Render ${fixture.format} ${fixture.mimeType}`, async () => {
          await commercialFiles(page)
            .getByRole("searchbox", { name: "Search Commercial Files" })
            .fill(fixture.name);
          const opener = commercialCard(page, fixture.name).getByRole("button", {
            exact: true,
            name: "View",
          });
          const responseReady = page.waitForResponse(
            (candidate) => new URL(candidate.url()).searchParams.get("mode") === "preview"
          );
          await opener.click();
          const response = await responseReady;
          expect(response.headers()["cache-control"]).toContain("private, no-store");
          expect(response.headers()["x-content-type-options"]).toBe("nosniff");
          expect(new URL(response.url()).origin).toBe(new URL(page.url()).origin);
          await assertRendered(page, fixture);
          expect(downloads).toBe(0);
          expect(forbiddenRequests).toBe(0);
          await closePreview(page, opener);
          await expect(
            commercialFiles(page).getByRole("searchbox", { name: "Search Commercial Files" })
          ).toHaveValue(fixture.name);
        });
      }
      const [pdfFixture] = fixtures;
      await commercialFiles(page)
        .getByRole("searchbox", { name: "Search Commercial Files" })
        .fill(pdfFixture.name);
      await commercialCard(page, pdfFixture.name)
        .getByRole("button", { exact: true, name: "View" })
        .click();
      const sourceUrl = await viewer(page)
        .getByRole("link", { exact: true, name: "Download" })
        .getAttribute("href");
      expect(sourceUrl).toMatch(/^\/api\/portal\/files\/commercial\//);
      await explicitDownload(page, pdfFixture);
      expect(downloads).toBe(1);
      await closePreview(page);
      await page.setViewportSize({ height: 844, width: 390 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await commercialCard(page, pdfFixture.name)
        .getByRole("button", { exact: true, name: "View" })
        .click();
      await assertRendered(page, pdfFixture);
      await expect(
        viewer(page).getByRole("button", { name: "Close document preview" })
      ).toBeInViewport();
      expect(
        await viewer(page).evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
      ).toBe(true);
      const directLink = page.url();
      await page.reload();
      await assertRendered(page, pdfFixture);
      expect(page.url()).toBe(directLink);
      if (!sourceUrl) {
        throw new Error("Preview did not expose an authenticated source route");
      }
      await assertDenied(browser, sourceUrl);
    } finally {
      await context.close();
    }
  });

  test("[document-preview-lifecycle] Sales recovers failed previews and reauthorizes deleted and restored files", async ({
    browser,
  }) => {
    const { context, page } = await openPortalAs(browser, "sales");
    try {
      const fixture = { ...previewCorpusFixture("text"), name: "preview-navigation-first.txt" };
      const adjacent = { ...previewCorpusFixture("text"), name: "preview-navigation-second.txt" };
      const hostile = (["corrupt", "encrypted", "expansion_limit"] as const).map(
        hostileOfficeFixture
      );
      await createCommercialFiles(page, [fixture, adjacent, ...hostile]);
      await commercialFiles(page)
        .getByRole("searchbox", { name: "Search Commercial Files" })
        .fill("preview-navigation");
      const firstOpener = commercialFiles(page)
        .getByRole("button", { exact: true, name: "View" })
        .first();
      let requestedPreviews = 0;
      const countPreview = (request: import("@playwright/test").Request) => {
        if (new URL(request.url()).searchParams.get("mode") === "preview") {
          requestedPreviews += 1;
        }
      };
      page.on("request", countPreview);
      await firstOpener.click();
      await expect(viewer(page).getByText("Day 1: Delhi", { exact: false })).toBeVisible();
      const firstName = await viewer(page).getByRole("heading").textContent();
      expect(requestedPreviews).toBe(1);
      await viewer(page).getByRole("button", { name: "View next file" }).click();
      await expect(viewer(page).getByText("Day 1: Delhi", { exact: false })).toBeVisible();
      await expect(viewer(page).getByRole("heading")).not.toHaveText(firstName ?? "");
      expect(requestedPreviews).toBe(2);
      await closePreview(page, firstOpener);
      page.off("request", countPreview);
      await expect(
        commercialFiles(page).getByRole("searchbox", { name: "Search Commercial Files" })
      ).toHaveValue("preview-navigation");
      for (const broken of hostile) {
        await test.step(`Recover ${broken.name}`, async () => {
          await commercialFiles(page)
            .getByRole("searchbox", { name: "Search Commercial Files" })
            .fill(broken.name);
          await commercialCard(page, broken.name)
            .getByRole("button", { exact: true, name: "View" })
            .click();
          await expect(
            viewer(page).getByRole("alert", { name: "Document preview error" })
          ).toBeVisible();
          await expect(viewer(page).getByRole("textbox", { name: /password/i })).toHaveCount(0);
          await explicitDownload(page, broken);
          await closePreview(page);
        });
      }
      await commercialFiles(page)
        .getByRole("searchbox", { name: "Search Commercial Files" })
        .fill(fixture.name);
      const card = commercialCard(page, fixture.name);
      const opener = card.getByRole("button", { exact: true, name: "View" });
      await opener.click();
      await assertRendered(page, fixture);
      const sourceUrl = await viewer(page)
        .getByRole("link", { exact: true, name: "Download" })
        .getAttribute("href");
      await page.goBack();
      await expect(viewer(page)).toBeHidden();
      await expect(opener).toBeFocused();
      if (!sourceUrl) {
        throw new Error("Preview did not expose an authenticated source route");
      }
      // Explicitly injected transport failure proves recovery UI, not converter operation success.
      let previewRequests = 0;
      await page.route(`**${sourceUrl}?mode=preview*`, async (route) => {
        previewRequests += 1;
        if (previewRequests === 1) {
          await route.fulfill({
            body: JSON.stringify({
              canRetry: true,
              errorCode: "conversion_failed",
              status: "unavailable",
            }),
            contentType: "application/json",
            status: 422,
          });
        } else {
          expect(new URL(route.request().url()).searchParams.get("retry")).toBe("1");
          await route.continue();
        }
      });
      await opener.click();
      await viewer(page).getByRole("button", { exact: true, name: "Retry preview" }).click();
      await assertRendered(page, fixture);
      expect(previewRequests).toBe(2);
      await closePreview(page, opener);
      await page.unroute(`**${sourceUrl}?mode=preview*`);
      await card.getByRole("button", { exact: true, name: `Delete ${fixture.name}` }).click();
      await holdToConfirmDelete(page);
      const deletedResponse = await page.request.get(`${sourceUrl}?mode=preview`);
      expect([403, 404, 422]).toContain(deletedResponse.status());
      expect(await deletedResponse.text()).not.toContain("Preview fixture");
      await commercialFiles(page).getByRole("checkbox", { name: "Recoverable deletions" }).check();
      await commercialCard(page, fixture.name)
        .getByRole("button", { exact: true, name: "Restore" })
        .click();
      await commercialFiles(page)
        .getByRole("checkbox", { name: "Recoverable deletions" })
        .uncheck();
      await opener.click();
      await assertRendered(page, fixture);
    } finally {
      await context.close();
    }
  });

  test("[document-preview-chain] Contracting previews linked attachments and replacement Proposal Docs preserve source-team authority", async ({
    browser,
  }) => {
    const sales = await openPortalAs(browser, "sales");
    const contracting = await openPortalAs(browser, "contracting");
    try {
      const queryFixture = previewCorpusFixture("docx");
      const workingFixture = previewCorpusFixture("pptx");
      const oldDoc = { ...previewCorpusFixture("pdf"), name: "preview-old-proposal.pdf" };
      const currentDoc = { ...previewCorpusFixture("pdf"), name: "preview-current-proposal.pdf" };
      currentDoc.buffer = Buffer.from(
        currentDoc.buffer.toString().replace("Second page", "New content")
      );
      const clientName = uniqueE2eLabel("E2E Preview Chain");
      const queries = new QueriesPage(sales.page);
      await queries.open();
      await queries.createQuery(clientName);
      await entityModal(sales.page).getByLabel("Attachments").setInputFiles(queryFixture);
      await saveEntityModal(sales.page);
      await contracting.page.goto("/portal/contracting");
      await contracting.page
        .locator("tr")
        .filter({ hasText: clientName })
        .getByRole("button", { exact: true, name: queryFixture.name })
        .click();
      await assertRendered(contracting.page, queryFixture);
      await closePreview(contracting.page);
      const proposals = new ProposalsPage(contracting.page);
      await proposals.open();
      await proposals.createProposalForQuery(clientName);
      await saveEntityModal(contracting.page);
      const row = proposals.proposalRow(clientName);
      await row.getByRole("button", { exact: true, name: "Files" }).click();
      await commercialFiles(contracting.page)
        .getByLabel("Choose files", { exact: true })
        .setInputFiles(workingFixture);
      await commercialFiles(contracting.page)
        .getByRole("button", { exact: true, name: "Upload files" })
        .click();
      await expect(commercialCard(contracting.page, workingFixture.name)).toBeVisible();
      await commercialFiles(contracting.page)
        .getByRole("button", { name: "Close Commercial Files" })
        .click();
      await row.getByRole("button", { exact: true, name: workingFixture.name }).click();
      await assertRendered(contracting.page, workingFixture);
      await closePreview(contracting.page);
      await row.getByRole("button", { exact: true, name: "Files" }).click();
      await selectOptionByMatchingLabel(
        commercialFiles(contracting.page).getByRole("combobox", { name: "Upload category" }),
        "Proposal Doc (PDF)"
      );
      for (const document of [oldDoc, currentDoc]) {
        await test.step(`Upload ${document.name}`, async () => {
          await commercialFiles(contracting.page)
            .getByLabel("Choose file", { exact: true })
            .setInputFiles(document);
          await commercialFiles(contracting.page)
            .getByRole("button", { exact: true, name: "Upload files" })
            .click();
          await expect(commercialCard(contracting.page, document.name)).toBeVisible();
        });
      }
      await commercialFiles(contracting.page)
        .getByRole("button", { name: "Close Commercial Files" })
        .click();
      await row.getByRole("button", { exact: true, name: currentDoc.name }).click();
      await assertRendered(contracting.page, currentDoc);
      await viewer(contracting.page)
        .getByRole("textbox", { name: "Search this document" })
        .fill("New content");
      await viewer(contracting.page).getByRole("button", { exact: true, name: "Find" }).click();
      await expect(viewer(contracting.page).getByText(/1 of 1 match/)).toBeVisible();
      await expect(viewer(contracting.page).getByRole("article")).toContainText("New content");
      await explicitDownload(contracting.page, currentDoc);
      await queries.open();
      const queryRow = queries.queryRow(clientName);
      await queryRow.getByRole("button", { name: /More actions for/ }).click();
      await sales.page.getByRole("menuitem", { exact: true, name: "Files" }).click();
      const sharedDoc = commercialCard(sales.page, currentDoc.name);
      await expect(sharedDoc.getByRole("button", { name: /Delete|Edit note/ })).toHaveCount(0);
      await expect(commercialFiles(sales.page).getByText(oldDoc.name, { exact: true })).toHaveCount(
        0
      );
      await sharedDoc.getByRole("button", { exact: true, name: "View" }).click();
      await assertRendered(sales.page, currentDoc);
    } finally {
      await sales.context.close();
      await contracting.context.close();
    }
  });

  test("[document-preview-expense] Finance views an owned attachment without adjacent files and unrelated Staff are denied", async ({
    browser,
  }) => {
    const { context, page } = await openPortalAs(browser, "finance");
    try {
      const fixture = previewCorpusFixture("pdf");
      const label = uniqueE2eLabel("E2E Preview Expense");
      await page.goto("/portal/expenses");
      await page
        .getByTestId("portal-list-toolbar-actions")
        .getByRole("button", { name: "Add Expense" })
        .click();
      await selectOptionByMatchingLabel(modalField(page, "Expense Type"), "Office / General");
      await fillPortalDate(modalField(page, "Expense Date"), isoDate());
      await selectOptionByMatchingLabel(modalField(page, "Category"), "F&B");
      await modalField(page, "Paid By").fill(label);
      await modalField(page, "Card Amount").fill("100");
      await entityModal(page).locator("#expense-proof-files").setInputFiles(fixture);
      await saveEntityModal(page);
      const row = page.locator("tr").filter({ hasText: label });
      await row.getByRole("button", { exact: true, name: fixture.name }).click();
      await assertRendered(page, fixture);
      await expect(viewer(page).getByRole("group", { name: "File navigation" })).toHaveCount(0);
      const sourceUrl = await viewer(page)
        .getByRole("link", { exact: true, name: "Download" })
        .getAttribute("href");
      await explicitDownload(page, fixture);
      await closePreview(page);
      await page.setViewportSize({ height: 844, width: 390 });
      if (!sourceUrl) {
        throw new Error("Expense preview did not expose its private source route");
      }
      await page.goto(`/portal/expenses?preview=${encodeURIComponent(sourceUrl)}`);
      await assertRendered(page, fixture);
      await expect(viewer(page).getByRole("group", { name: "File navigation" })).toHaveCount(0);
      await assertDenied(browser, sourceUrl);
    } finally {
      await context.close();
    }
  });

  test("[document-preview-passport] Operations previews one encrypted passport and unrelated Staff are denied", async ({
    browser,
  }) => {
    const { context, page } = await openPortalAs(browser, "operations");
    try {
      const fixture = previewCorpusFixture("pdf");
      const travellerName = uniqueE2eLabel("E2E Preview Traveller");
      const travellers = new TravellersPage(page);
      await travellers.open();
      const jobCode = await travellers.firstAvailableJobCardLabel();
      test.skip(!jobCode, "No Job Card is available for the owned passport fixture.");
      if (!jobCode) {
        throw new Error("Passport preview requires an authorized Job Card fixture");
      }
      await travellers.createTraveller(jobCode, travellerName);
      await saveEntityModal(page);
      await page.goto("/portal/passport");
      const row = page.locator("tr").filter({ hasText: travellerName });
      await row.getByRole("button", { name: /upload passport scan|upload scan/i }).click();
      await page.locator("#passport-file-input").setInputFiles(fixture);
      await page.getByRole("button", { exact: true, name: "Encrypt & Upload" }).click();
      await expect(page.getByRole("heading", { name: /Upload & Encrypt Passport:/ })).toBeHidden();
      await row.getByRole("button", { exact: true, name: "Decrypt & View" }).click();
      await assertRendered(page, fixture);
      await expect(viewer(page).getByRole("group", { name: "File navigation" })).toHaveCount(0);
      const sourceUrl = await viewer(page)
        .getByRole("link", { exact: true, name: "Download" })
        .getAttribute("href");
      await explicitDownload(page, fixture);
      await closePreview(page);
      if (!sourceUrl) {
        throw new Error("Passport preview did not expose its Traveller-scoped source route");
      }
      await page.setViewportSize({ height: 844, width: 390 });
      await page.goto(`/portal/passport?preview=${encodeURIComponent(sourceUrl)}`);
      await assertRendered(page, fixture);
      await expect(viewer(page).getByRole("group", { name: "File navigation" })).toHaveCount(0);
      await assertDenied(browser, sourceUrl);
    } finally {
      await context.close();
    }
  });
});
