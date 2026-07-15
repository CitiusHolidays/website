import { describe, expect, test } from "bun:test";
import {
  desktopActionColumnClass,
  desktopPinnedColumnClass,
  preparePortalColumns,
} from "@/lib/portal/portalDataGrid";

describe("responsive data cards", () => {
  test("models mobile presentation from typed column metadata", () => {
    const columns = preparePortalColumns([
      { id: "query", kind: "identity", label: "Query", render: () => "Q-0001" },
      { id: "workflow", kind: "status", label: "Workflow", render: () => "Pending" },
      { id: "audit", kind: "data", label: "Action", render: () => "Audit note" },
      { id: "open", kind: "action", label: "Open", render: () => "Open" },
    ]);

    expect(columns.map(({ id, mobile }) => [id, mobile])).toEqual([
      ["query", "primary"],
      ["workflow", "status"],
      ["audit", "secondary"],
      ["open", "action"],
    ]);
  });

  test("pins only columns explicitly modeled as actions", () => {
    expect(desktopActionColumnClass("action", "header")).toContain("sticky right-0");
    expect(desktopActionColumnClass("data", "cell")).toBe("");
    expect(desktopActionColumnClass(undefined, "cell")).toBe("");
  });

  test("pins record identity to the left without using the action treatment", () => {
    expect(desktopPinnedColumnClass("identity", "header")).toContain("sticky left-0");
    expect(desktopPinnedColumnClass("identity", "cell")).toContain("sticky left-0");
    expect(desktopPinnedColumnClass("status", "cell")).toBe("");
  });
});
