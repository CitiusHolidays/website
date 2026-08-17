import { describe, expect, test } from "bun:test";
import {
  classifyDocumentPreview,
  documentPreviewRolloutAllows,
  fileNameFromContentDisposition,
  isSensitivePortalFileUrl,
  portalFileDownloadUrl,
  portalFilePreviewUrl,
} from "./documentPreview";

describe("document preview routing policy", () => {
  test("keeps preview and download on private same-origin portal routes", () => {
    const route = "/api/portal/files/commercial/file-1";

    expect(portalFilePreviewUrl(route)).toBe("/api/portal/files/commercial/file-1?mode=preview");
    expect(portalFileDownloadUrl(`${route}?mode=preview`)).toBe(route);
    expect(() => portalFilePreviewUrl("https://viewer.example.test/file-1")).toThrow(
      "Document preview only supports private portal file routes."
    );
  });

  test("classifies every accepted upload format without trusting MIME alone", () => {
    expect(
      classifyDocumentPreview({ fileName: "offer.PDF", mimeType: "application/octet-stream" })
    ).toBe("pdf");
    expect(classifyDocumentPreview({ fileName: "scan.webp", mimeType: "image/webp" })).toBe(
      "image"
    );
    expect(classifyDocumentPreview({ fileName: "notes.txt", mimeType: "text/plain" })).toBe("text");
    expect(classifyDocumentPreview({ fileName: "diagram.svg", mimeType: "image/svg+xml" })).toBe(
      "unsupported"
    );
    expect(classifyDocumentPreview({ fileName: "plan.docx", mimeType: "" })).toBe("docx");
    expect(classifyDocumentPreview({ fileName: "costing.xlsx", mimeType: "" })).toBe("xlsx");
    expect(classifyDocumentPreview({ fileName: "deck.pptx", mimeType: "" })).toBe("pptx");
    for (const legacyName of ["plan.doc", "costing.xls", "deck.ppt"]) {
      expect(classifyDocumentPreview({ fileName: legacyName, mimeType: "" })).toBe("unsupported");
    }
    expect(classifyDocumentPreview({ fileName: "archive.zip", mimeType: "application/zip" })).toBe(
      "unsupported"
    );
  });

  test("identifies one-file sensitive routes and safely reads response filenames", () => {
    expect(isSensitivePortalFileUrl("/api/portal/files/passport/traveller-1")).toBe(true);
    expect(isSensitivePortalFileUrl("/api/portal/files/commercial/file-1")).toBe(false);
    expect(
      fileNameFromContentDisposition(
        "inline; filename=offer.pdf; filename*=UTF-8''Sacred%20Bharat%20Offer.pdf"
      )
    ).toBe("Sacred Bharat Offer.pdf");
    expect(fileNameFromContentDisposition(null)).toBeNull();
  });

  test("fails rollout closed and advances through the approved source stages", () => {
    const original = process.env.NEXT_PUBLIC_DOCUMENT_PREVIEW_ROLLOUT_STAGE;
    try {
      process.env.NEXT_PUBLIC_DOCUMENT_PREVIEW_ROLLOUT_STAGE = "commercial-native";
      expect(
        documentPreviewRolloutAllows({
          fileName: "offer.pdf",
          sourceUrl: "/api/portal/files/commercial/file-1",
        })
      ).toBe(true);
      expect(
        documentPreviewRolloutAllows({
          fileName: "costing.xlsx",
          sourceUrl: "/api/portal/files/commercial/file-1",
        })
      ).toBe(false);
      for (const fileName of ["costing.xls", "archive.zip"]) {
        expect(
          documentPreviewRolloutAllows({
            fileName,
            sourceUrl: "/api/portal/files/commercial/file-1",
          })
        ).toBe(false);
      }
      expect(
        documentPreviewRolloutAllows({
          sourceUrl: "/api/portal/files/commercial/file-1",
        })
      ).toBe(false);
      process.env.NEXT_PUBLIC_DOCUMENT_PREVIEW_ROLLOUT_STAGE = "commercial-office";
      expect(
        documentPreviewRolloutAllows({
          sourceUrl: "/api/portal/files/commercial/file-1",
        })
      ).toBe(true);
      process.env.NEXT_PUBLIC_DOCUMENT_PREVIEW_ROLLOUT_STAGE = "commercial-chain";
      expect(
        documentPreviewRolloutAllows({ sourceUrl: "/api/portal/files/query/attachment-1" })
      ).toBe(true);
      expect(
        documentPreviewRolloutAllows({ sourceUrl: "/api/portal/files/passport/traveller-1" })
      ).toBe(false);
      process.env.NEXT_PUBLIC_DOCUMENT_PREVIEW_ROLLOUT_STAGE = "not-reviewed";
      expect(
        documentPreviewRolloutAllows({ sourceUrl: "/api/portal/files/commercial/file-1" })
      ).toBe(false);
    } finally {
      if (original === undefined) {
        delete process.env.NEXT_PUBLIC_DOCUMENT_PREVIEW_ROLLOUT_STAGE;
      } else {
        process.env.NEXT_PUBLIC_DOCUMENT_PREVIEW_ROLLOUT_STAGE = original;
      }
    }
  });
});
