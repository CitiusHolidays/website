import { describe, expect, test } from "bun:test";
import { assertSafeImagePreview } from "@convex/crm/lib/documentPreviewImageSafety";
import { materializeDocxDocument, materializePptxPresentation } from "@silurus/ooxml/node";
import ExcelJS from "exceljs";
import sharp from "sharp";
import { classifyDocumentPreview } from "../../src/lib/portal/documentPreview";
import { assertSafeOfficeArchive } from "../../src/lib/portal/officeArchiveSafety";
import { assertSafePdfStreams } from "../../src/lib/portal/pdfPreviewSafety";
import { prepareSpreadsheetPreview } from "../../src/lib/portal/spreadsheetPreview";
import {
  DOCUMENT_PREVIEW_FORMATS,
  DOCUMENT_PREVIEW_MAX_BYTES,
  hostileOfficeFixture,
  previewCorpusFixture,
  previewRasterFixtures,
} from "./documentPreviewCorpus";

const ARCHIVE_LIMITS = {
  maxArchiveEntries: 4096,
  maxArchiveEntryBytes: 64 * 1024 * 1024,
  maxTotalInflatedBytes: 192 * 1024 * 1024,
};

function bytes(buffer: Buffer) {
  return Uint8Array.from(buffer).buffer;
}

describe("Synthetic Document Preview corpus", () => {
  for (const format of DOCUMENT_PREVIEW_FORMATS) {
    test(`${format} has reproducible small and exact 15 MB source fixtures`, async () => {
      const small = previewCorpusFixture(format);
      const boundary = previewCorpusFixture(format, "size_boundary");
      expect(small.buffer.equals(previewCorpusFixture(format).buffer)).toBe(true);
      expect(boundary.buffer.byteLength).toBe(DOCUMENT_PREVIEW_MAX_BYTES);
      expect(classifyDocumentPreview({ fileName: small.name, mimeType: small.mimeType })).toBe(
        format
      );
      if (format === "pdf") {
        await assertSafePdfStreams(bytes(boundary.buffer));
      } else if (format === "image") {
        expect(assertSafeImagePreview(bytes(boundary.buffer), boundary.mimeType).width).toBe(16);
        expect((await sharp(boundary.buffer).raw().toBuffer()).length).toBe(16 * 16 * 3);
      } else if (format === "text") {
        expect(new TextDecoder().decode(boundary.buffer)).toStartWith("Preview fixture");
      } else {
        await assertSafeOfficeArchive(bytes(boundary.buffer), ARCHIVE_LIMITS);
      }
    });
  }

  test("Word and PowerPoint fixtures parse into ordered readable content with the installed runtime", async () => {
    const word = await materializeDocxDocument(previewCorpusFixture("docx").buffer);
    const deck = await materializePptxPresentation(previewCorpusFixture("pptx").buffer);
    const documentText = JSON.stringify(word);
    const slideText = JSON.stringify(deck);
    expect(documentText.indexOf("Preview fixture")).toBeLessThan(
      documentText.indexOf("Second page")
    );
    expect(slideText.indexOf("Preview fixture")).toBeLessThan(slideText.indexOf("Second slide"));
    expect(documentText).toContain("Second page");
    expect(slideText).toContain("Second slide");
  });

  test("Workbook fixture recalculates safe totals and preserves marked unsupported and missing results", async () => {
    const result = await prepareSpreadsheetPreview(bytes(previewCorpusFixture("xlsx").buffer));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.bytes);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Costs", "Summary"]);
    expect(workbook.getWorksheet("Costs")?.getCell("B1").result).toBe(60);
    expect(workbook.getWorksheet("Summary")?.getCell("A1").result).toBe(20);
    expect(workbook.getWorksheet("Costs")?.getCell("B2").result).toBe(7);
    expect(workbook.getWorksheet("Costs")?.getCell("B3").result).toBeUndefined();
    expect(result.unsupportedFormulaCount).toBe(2);
    expect(result.recalculatedFormulaCount).toBe(2);
  });

  test("All accepted raster fixtures decode and a MIME mismatch fails closed", async () => {
    for (const fixture of previewRasterFixtures()) {
      expect(assertSafeImagePreview(bytes(fixture.buffer), fixture.mimeType).width).toBe(16);
      expect((await sharp(fixture.buffer).raw().toBuffer()).length).toBeGreaterThan(0);
    }
    expect(() =>
      assertSafeImagePreview(bytes(previewCorpusFixture("image").buffer), "image/jpeg")
    ).toThrow("does not match");
  });

  for (const kind of ["corrupt", "encrypted", "expansion_limit"] as const) {
    test(`${kind} Office bytes fail at the processor boundary`, async () => {
      await expect(
        prepareSpreadsheetPreview(bytes(hostileOfficeFixture(kind).buffer))
      ).rejects.toThrow();
    });
  }

  test("Legacy binaries remain download-only in the current preview contract", () => {
    for (const extension of ["doc", "ppt", "xls"]) {
      expect(classifyDocumentPreview({ fileName: `fixture.${extension}` })).toBe("unsupported");
    }
  });
});
