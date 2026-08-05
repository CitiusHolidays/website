import { describe, expect, test } from "bun:test";
import { resetWorkspaceView } from "./workspaceStateTypes";

describe("resetWorkspaceView", () => {
  test("clears view-local state only when the active view changes", () => {
    const viewRef = { current: "dashboard" };

    expect(resetWorkspaceView(viewRef, "dashboard")).toEqual({});
    expect(resetWorkspaceView(viewRef, "queries")).toEqual({
      error: "",
      form: expect.any(Object),
      isSaving: false,
      modal: null,
      pendingExpenseProofFiles: [],
      pendingProposalFiles: [],
      pendingQueryFiles: [],
      saveFlash: false,
    });
    expect(viewRef.current).toBe("queries");
  });
});
