import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const FILES = {
  confirmDialog: "src/components/portal/PortalConfirmDialog.js",
  entityModalShell: "src/components/portal/entityModal/EntityModalShell.js",
  listToolbar: "src/components/portal/PortalListToolbar.js",
};

describe("portal interaction test seams", () => {
  test("exposes shared data-testid hooks on modal, confirm, and toolbar chrome", () => {
    const entityModal = readFileSync(FILES.entityModalShell, "utf8");
    const confirmDialog = readFileSync(FILES.confirmDialog, "utf8");
    const listToolbar = readFileSync(FILES.listToolbar, "utf8");

    expect(entityModal).toContain('data-testid="portal-entity-modal"');
    expect(entityModal).toContain('data-testid="portal-entity-modal-save"');
    expect(entityModal).toContain('data-testid="portal-entity-modal-cancel"');

    expect(confirmDialog).toContain('data-testid="portal-confirm-dialog"');
    expect(confirmDialog).toContain('data-testid="portal-confirm-cancel"');
    expect(confirmDialog).toContain('"portal-confirm-hold"');
    expect(confirmDialog).toContain('"portal-confirm-submit"');

    expect(listToolbar).toContain('data-testid="portal-list-toolbar-actions"');
  });
});
