import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/portal/PortalModalForm.js", "utf8");
const FILE_INPUT_PATTERN = /type="file"/;

describe("portal modal form Staff primitive boundary", () => {
  test("routes stateless text fields and actions through shared application primitives", () => {
    expect(source).toContain('import { Button } from "@/components/ui/application-button"');
    expect(source).toContain('from "@/components/ui/application-field"');
    expect(source).toContain("Input as StaffInput");
    expect(source).toContain("Textarea as StaffTextarea");
    expect(source).toContain("<StaffInput");
    expect(source).toContain("<StaffTextarea");
    expect(source).not.toContain("<button");
  });

  test("routes controlled selects and checkboxes through shared application primitives", () => {
    expect(source).toContain('from "@/components/ui/application-select"');
    expect(source).toContain('from "@/components/ui/application-checkbox"');
    expect(source).not.toContain("<select");
    expect(source).not.toContain('type="checkbox"');
  });

  test("keeps native calendar and file controls intentional", () => {
    expect(source).toContain("<PortalDateInput");
    expect(source).toMatch(FILE_INPUT_PATTERN);
  });
});
