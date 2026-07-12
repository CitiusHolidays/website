import { describe, expect, test } from "bun:test";
import { desktopActionColumnClass, splitMobileColumns } from "./ResponsiveDataCards";

describe("responsive data cards", () => {
  test("separates record actions from readable mobile data", () => {
    const query = ["Query", () => "Q-0001", { kind: "data" }];
    const status = ["Workflow", () => "Pending", { kind: "status" }];
    const action = ["Next step", () => "Edit", { kind: "action" }];
    const actions = ["Options", () => "Open", { kind: "action" }];

    expect(splitMobileColumns([query, status, action, actions])).toEqual({
      actions: [action, actions],
      data: [query, status],
    });
  });

  test("does not infer column behavior from display labels", () => {
    const dataNamedAction = ["Action", () => "Audit note", { kind: "data" }];

    expect(splitMobileColumns([dataNamedAction])).toEqual({
      actions: [],
      data: [dataNamedAction],
    });
  });

  test("pins only columns explicitly modeled as actions", () => {
    expect(desktopActionColumnClass("action", "header")).toContain("sticky right-0");
    expect(desktopActionColumnClass("data", "cell")).toBe("");
    expect(desktopActionColumnClass(undefined, "cell")).toBe("");
  });
});
