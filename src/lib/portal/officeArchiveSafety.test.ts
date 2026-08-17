import { describe, expect, test } from "bun:test";
import ExcelJS from "exceljs";
import { assertSafeOfficeArchive } from "./officeArchiveSafety";

const LIMITS = {
  maxArchiveEntries: 4096,
  maxArchiveEntryBytes: 64 * 1024 * 1024,
  maxTotalInflatedBytes: 192 * 1024 * 1024,
};

describe("Office archive safety", () => {
  test("accepts a normal workbook only after measuring actual inflated entry sizes", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Costs").getCell("A1").value = 10;
    const bytes = await workbook.xlsx.writeBuffer();
    await expect(assertSafeOfficeArchive(bytes, LIMITS)).resolves.toBeUndefined();
  });

  test("rejects a declared expansion bomb before a workbook parser runs", async () => {
    const bytes = new ArrayBuffer(68);
    const view = new DataView(bytes);
    view.setUint32(0, 0x02_01_4b_50, true);
    view.setUint32(24, LIMITS.maxArchiveEntryBytes + 1, true);
    view.setUint32(46, 0x06_05_4b_50, true);
    view.setUint16(56, 1, true);
    view.setUint32(58, 46, true);
    view.setUint32(62, 0, true);
    await expect(assertSafeOfficeArchive(bytes, LIMITS)).rejects.toThrow("expansion limit");
  });

  test("rejects a forged small size after bounded streaming decompression", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Costs").getCell("A1").value = "x".repeat(2 * 1024 * 1024);
    const source = new Uint8Array(await workbook.xlsx.writeBuffer());
    const view = new DataView(source.buffer, source.byteOffset, source.byteLength);
    for (let offset = 0; offset + 46 <= source.byteLength; offset += 1) {
      if (view.getUint32(offset, true) === 0x02_01_4b_50) {
        view.setUint32(offset + 24, 1, true);
        break;
      }
    }
    await expect(assertSafeOfficeArchive(source.buffer, LIMITS)).rejects.toThrow("does not match");
  });
});
