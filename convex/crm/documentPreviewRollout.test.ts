import { describe, expect, test } from "vitest";
import {
  documentPreviewRolloutStage,
  isDocumentPreviewRolloutAllowed,
} from "./documentPreviewRollout";

describe("Document preview rollout stages", () => {
  test("Enables the released viewer by default and fails closed for invalid configuration", () => {
    expect(documentPreviewRolloutStage(undefined)).toBe("all");
    expect(documentPreviewRolloutStage("  ")).toBe("all");
    expect(documentPreviewRolloutStage("unexpected")).toBe("off");
    expect(isDocumentPreviewRolloutAllowed("commercialFile", "pdf", "off")).toBe(false);
  });

  test("Expands access only through the named rollout stages", () => {
    expect(isDocumentPreviewRolloutAllowed("commercialFile", "pdf", "commercial-native")).toBe(
      true
    );
    expect(isDocumentPreviewRolloutAllowed("commercialFile", "word", "commercial-native")).toBe(
      false
    );
    expect(isDocumentPreviewRolloutAllowed("commercialFile", "word", "commercial-office")).toBe(
      true
    );
    expect(isDocumentPreviewRolloutAllowed("proposalAttachment", "word", "commercial-chain")).toBe(
      true
    );
    expect(isDocumentPreviewRolloutAllowed("passport", "image", "sensitive")).toBe(true);
    expect(isDocumentPreviewRolloutAllowed("expenseAttachment", "image", "sensitive")).toBe(false);
    expect(isDocumentPreviewRolloutAllowed("expenseAttachment", "image", "all")).toBe(true);
    expect(isDocumentPreviewRolloutAllowed("commercialFile", "unsupported", "all")).toBe(false);
  });
});
