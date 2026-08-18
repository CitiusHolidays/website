import { describe, expect, test } from "vitest";
import { validateDocumentPreviewArtifact } from "./documentPreviewArtifact";

describe("Document preview artifact validation", () => {
  function minimalPdf() {
    const prefix = "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n";
    const xrefOffset = new TextEncoder().encode(prefix).byteLength;
    return `${prefix}xref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  }

  test("Accepts a bounded versioned spreadsheet artifact", async () => {
    const artifact = new Blob([
      JSON.stringify({
        schemaVersion: 1,
        sheets: [{ name: "Costing", rows: [["Total", 42, true, null]] }],
      }),
    ]);

    await expect(validateDocumentPreviewArtifact(artifact, "spreadsheet")).resolves.toEqual({
      valid: true,
    });
  });

  test("Rejects unversioned, unsafe, or unbounded spreadsheet artifacts", async () => {
    await expect(validateDocumentPreviewArtifact(new Blob(["{}"]), "spreadsheet")).resolves.toEqual(
      { errorCode: "corrupt", valid: false }
    );
    await expect(
      validateDocumentPreviewArtifact(
        new Blob(['{"schemaVersion":1,"sheets":[{"name":"Sheet1","rows":[]}],"constructor":{}}']),
        "spreadsheet"
      )
    ).resolves.toEqual({ errorCode: "unsafe_content", valid: false });
    await expect(
      validateDocumentPreviewArtifact(
        new Blob([
          JSON.stringify({
            schemaVersion: 1,
            sheets: Array.from({ length: 257 }, (_, index) => ({
              name: `Sheet ${index}`,
              rows: [],
            })),
          }),
        ]),
        "spreadsheet"
      )
    ).resolves.toEqual({ errorCode: "corrupt", valid: false });
    await expect(
      validateDocumentPreviewArtifact(
        new Blob([
          JSON.stringify({
            schemaVersion: 1,
            sheets: [{ name: "Sheet1", rows: [], unexpected: "field" }],
          }),
        ]),
        "spreadsheet"
      )
    ).resolves.toEqual({ errorCode: "corrupt", valid: false });
  });

  test("Requires both a PDF header and a trailing EOF marker", async () => {
    await expect(
      validateDocumentPreviewArtifact(new Blob([minimalPdf()]), "word")
    ).resolves.toEqual({ valid: true });
    await expect(
      validateDocumentPreviewArtifact(new Blob(["%PDF-1.7\nnot a PDF\n%%EOF"]), "word")
    ).resolves.toEqual({ errorCode: "corrupt", valid: false });
    const malformedXref = minimalPdf().replace("0000000009 00000 n", "not-an-xref-entry");
    await expect(
      validateDocumentPreviewArtifact(new Blob([malformedXref]), "word")
    ).resolves.toEqual({ errorCode: "corrupt", valid: false });
    await expect(
      validateDocumentPreviewArtifact(new Blob(["this is definitely not a PDF file"]), "word")
    ).resolves.toEqual({ errorCode: "signature_mismatch", valid: false });
    await expect(
      validateDocumentPreviewArtifact(new Blob(["%PDF-1.7\nwithout an eof marker"]), "word")
    ).resolves.toEqual({ errorCode: "corrupt", valid: false });
  });
});
