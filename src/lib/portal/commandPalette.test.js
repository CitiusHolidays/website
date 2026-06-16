import { describe, expect, test } from "bun:test";
import {
  buildCreateCommands,
  buildRecentRecordCommands,
  buildSavedViewCommands,
  filterCommands,
} from "./commandPalette.js";

describe("commandPalette", () => {
  test("gates create commands by permission", () => {
    const commands = buildCreateCommands({
      has: (permission) => permission === "manage:queries",
      openModal: () => {},
    });
    expect(commands.map((command) => command.id)).toEqual(["create:query"]);
  });

  test("builds recent and saved view commands", () => {
    const recent = buildRecentRecordCommands({
      navShortcuts: {
        queries: [{ id: "q1", label: "Q-1", href: "/portal/queries?open=query&id=q1" }],
      },
    });
    const saved = buildSavedViewCommands({
      savedViews: [
        {
          id: "sv1",
          name: "My jobs",
          view: "job-cards",
          pathname: "/portal/job-cards",
          filterState: { search: "acme" },
        },
      ],
    });
    expect(recent[0].href).toContain("open=query");
    expect(saved[0].group).toBe("Saved views");
    expect(saved[0].href).toBe("/portal/job-cards?q=acme");
  });

  test("filterCommands includes Recent before Saved views when both exist", () => {
    const commands = filterCommands(
      [
        ...buildRecentRecordCommands({
          navShortcuts: {
            queries: [{ id: "q1", label: "Q-1", href: "/portal/queries?open=query&id=q1" }],
          },
        }),
        ...buildSavedViewCommands({
          savedViews: [{ id: "sv1", name: "My jobs", view: "job-cards" }],
        }),
      ],
      "",
    );
    expect(commands.map((command) => command.group)).toEqual(["Recent", "Saved views"]);
  });

  test("filters commands by label, subtitle, and keywords", () => {
    const commands = filterCommands(
      [
        { id: "a", label: "New query", group: "Create", keywords: ["sales"] },
        { id: "b", label: "Job Cards", group: "Navigate", subtitle: "Operations" },
      ],
      "operations",
    );
    expect(commands.map((command) => command.id)).toEqual(["b"]);
  });
});
