import { describe, expect, test } from "bun:test";
import {
  buildCreateCommands,
  buildLayoutPresetCommands,
  buildRecentRecordCommands,
  buildSavedViewCommands,
  filterCommands,
} from "./commandPalette";
import { createPortalTableLayoutState, PORTAL_TABLE_LAYOUT_KIND } from "./tableLayoutPresets";

describe("CommandPalette", () => {
  test("Gates create commands by permission", () => {
    const commands = buildCreateCommands({
      has: (permission) => permission === "manage:queries",
      openModal: () => undefined,
    });
    expect(commands.map((command) => command.id)).toEqual(["create:query"]);
  });

  test("Builds recent and saved view commands", () => {
    const recent = buildRecentRecordCommands({
      navShortcuts: {
        queries: [{ href: "/portal/queries?open=query&id=q1", id: "q1", label: "Q-1" }],
      },
    });
    const saved = buildSavedViewCommands({
      savedViews: [
        {
          filterState: { search: "acme" },
          id: "sv1",
          name: "My jobs",
          pathname: "/portal/job-cards",
          view: "job-cards",
        },
      ],
    });
    expect(recent[0].href).toContain("open=query");
    expect(saved[0].group).toBe("Saved views");
    expect(saved[0].href).toBe("/portal/job-cards?q=acme");
  });

  test("Orders recent authorized records, saved views, and layouts without widening access", () => {
    const applyLayoutPreset = () => undefined;
    const commands = filterCommands(
      [
        ...buildRecentRecordCommands({
          navShortcuts: {
            queries: [{ href: "/portal/queries?open=query&id=q1", id: "q1", label: "Q-1" }],
          },
        }),
        ...buildSavedViewCommands({
          savedViews: [{ id: "sv1", name: "My jobs", view: "job-cards" }],
        }),
        ...buildLayoutPresetCommands({
          applyLayoutPreset,
          layoutPresets: [
            {
              filterState: createPortalTableLayoutState({
                columns: ["invoice"],
                scope: "finance:invoices",
                sort: null,
              }),
              id: "layout-1",
              name: "Finance review",
              sharedRole: "Finance",
              view: "finance",
            },
            {
              filterState: { columns: "invoice", kind: PORTAL_TABLE_LAYOUT_KIND },
              id: "layout-malformed",
              name: "Malformed layout",
              view: "finance",
            },
          ],
        }),
      ],
      ""
    );
    expect(commands.map((command) => command.group)).toEqual([
      "Recent authorized records",
      "Saved views",
      "Layouts",
    ]);
    expect(commands.at(-1)).toMatchObject({
      id: "layout:layout-1",
      subtitle: "Finance role layout",
    });
    expect(commands.at(-1).href).toBeUndefined();
  });

  test("Filters commands by label, subtitle, and keywords", () => {
    const commands = filterCommands(
      [
        { group: "Create", id: "a", keywords: ["sales"], label: "New query" },
        { group: "Navigate", id: "b", label: "Job Cards", subtitle: "Operations" },
      ],
      "operations"
    );
    expect(commands.map((command) => command.id)).toEqual(["b"]);
  });
});
