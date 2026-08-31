import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const GLOBALS = readFileSync("src/app/globals.css", "utf8");
const FIELD_VARIANTS = readFileSync("src/components/ui/application-field-variants.ts", "utf8");
const PORTAL_SEARCH = readFileSync("src/components/portal/PortalSearchField.tsx", "utf8");
const PORTAL_DATE = readFileSync("src/components/portal/PortalDateInput.js", "utf8");
const CONCIERGE_HANDOFF = readFileSync("src/components/ui/ConciergeContactHandoff.js", "utf8");
const AUTH_SHELL = readFileSync("src/components/auth/AuthShell.js", "utf8");
const DOCUMENT_PREVIEW = readFileSync(
  "src/components/portal/document-preview/DocumentPreviewRenderers.tsx",
  "utf8"
);
const OPERATIONAL_CONTROLS = readFileSync(
  "src/components/portal/settings/OperationalControlPanelSections.tsx",
  "utf8"
);
const COMMAND_PALETTE = readFileSync("src/components/portal/PortalCommandPalette.js", "utf8");
const SAVE_VIEW_DIALOG = readFileSync("src/components/portal/SaveViewDialog.js", "utf8");
const ACCOUNT_UI = readFileSync("src/components/account/AccountUi.js", "utf8");
const PORTAL_SHELL = readFileSync("src/components/portal/PortalShell.tsx", "utf8");
const ACCOUNT_SHELL = readFileSync("src/app/(authenticated)/account/page.client.js", "utf8");
const MOBILE_PORTAL_INPUT_PATTERN = /\.portal-input\s*{[^}]*font-size:\s*1rem/s;
const PORTAL_COMMAND_SURFACE_PATTERN =
  /\.portal-command-surface\s*{[^}]*--material-preference-background:\s*var\(--color-brand-light\);[^}]*--material-preference-boundary:\s*var\(--color-brand-muted\);/s;
const PORTAL_SHELL_PATTERN =
  /\.portal-shell\s*{\s*--material-preference-background:\s*var\(--color-brand-light\);\s*--material-preference-boundary:\s*var\(--color-brand-muted\);\s*}/s;
const ACCOUNT_SHELL_PATTERN =
  /\.account-shell\s*{\s*--material-preference-background:\s*var\(--account-surface\);\s*--material-preference-boundary:\s*var\(--account-border\);\s*}/s;
const AUTH_MATERIAL_RECIPE =
  "[--material-preference-background:#FDFBF7] [--material-preference-boundary:#0B1026]";

describe("cross-surface accessibility contract", () => {
  test("keeps mobile data entry at a 16px floor without changing desktop density", () => {
    for (const source of [FIELD_VARIANTS, PORTAL_SEARCH, PORTAL_DATE, CONCIERGE_HANDOFF]) {
      expect(source).toContain("text-base");
      expect(source).toContain("sm:text-sm");
    }
    expect(GLOBALS).toMatch(MOBILE_PORTAL_INPUT_PATTERN);
  });

  test("keeps Staff, Account, and Auth preference fallbacks product-owned", () => {
    expect(GLOBALS).toMatch(PORTAL_SHELL_PATTERN);
    expect(GLOBALS).toMatch(ACCOUNT_SHELL_PATTERN);
    expect(GLOBALS).toContain('[class*="text-brand-muted/"]');
    expect(PORTAL_SHELL).toContain('className="portal-shell');
    expect(ACCOUNT_SHELL).toContain('className="account-shell');
    expect(AUTH_SHELL).toContain("material-structural");
    expect(AUTH_SHELL).toContain(AUTH_MATERIAL_RECIPE);
    expect(DOCUMENT_PREVIEW).toContain("material-floating");
    expect(OPERATIONAL_CONTROLS).toContain("material-structural");
    expect(ACCOUNT_UI).toContain("material-decorative-glass");

    for (const source of [PORTAL_SHELL, COMMAND_PALETTE, SAVE_VIEW_DIALOG]) {
      expect(source).not.toContain("--account-surface");
      expect(source).not.toContain("--color-public-night");
      expect(source).not.toContain("--material-preference-background:#FDFBF7");
    }
    for (const source of [ACCOUNT_SHELL, ACCOUNT_UI]) {
      expect(source).not.toContain("--color-brand-light");
      expect(source).not.toContain("--color-public-night");
      expect(source).not.toContain("--material-preference-background:#FDFBF7");
    }
    for (const foreignToken of [
      "--color-brand-light",
      "--account-surface",
      "--color-public-night",
    ]) {
      expect(AUTH_SHELL).not.toContain(foreignToken);
    }
  });

  test("keeps Staff command dialogs on the shared opaque material owner", () => {
    expect(GLOBALS).toMatch(PORTAL_COMMAND_SURFACE_PATTERN);
    for (const source of [COMMAND_PALETTE, SAVE_VIEW_DIALOG]) {
      expect(source).toContain("portal-command-surface");
      expect(source).not.toContain("[--material-preference-background:var(--color-brand-light)]");
    }
  });
});
