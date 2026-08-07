import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const shell = readFileSync("src/components/portal/PortalShell.tsx", "utf8");
const activity = readFileSync("src/components/portal/workspace/admin/ActivityView.tsx", "utf8");

test("staff notifications and mobile navigation use scoped Base UI behavior", () => {
  expect(shell).toContain('import { PortalPopover } from "@/components/portal/PortalPopover"');
  expect(shell).toContain('import { Dialog as BaseDialog } from "@/components/ui/foundation/base"');
  expect(shell).toContain("<BaseDialog.Root");
  expect(shell).toContain("<BaseDialog.Portal>");
  expect(shell).toContain("<BaseDialog.Backdrop");
  expect(shell).toContain("<BaseDialog.Popup");
  expect(shell).toContain("<BaseDialog.Close");
  expect(activity).toContain('import { Button } from "@/components/ui/application-button"');
  expect(activity).not.toContain('from "@/components/ui/foundation/base"');
  expect(activity).toContain("nativeButton={false}");
  expect(activity).toContain("render={<div />}");
  expect(shell).not.toContain("application-dialog");
  expect(shell).not.toContain("PortalCommandPalette");
});
