import { describe, expect, test } from "bun:test";
import {
  buildCreateCommands,
  buildNavigationCommands,
  buildRecentRecordCommands,
  buildSavedViewCommands,
  filterCommands,
} from "./commandPalette";
import { PORTAL_NAV_GROUPS } from "./constants";
import { getAccessibleNavGroups, getPermissionsForRoles } from "./permissions";

const byText = (first, second) => first.localeCompare(second);

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

  test("FilterCommands includes Recent before Saved views when both exist", () => {
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
      ],
      ""
    );
    expect(commands.map((command) => command.group)).toEqual(["Recent", "Saved views"]);
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

  test("Offers every sidebar destination, with the regrouped labels and old URL as keywords", () => {
    const roles = ["Admin"];
    const navGroups = getAccessibleNavGroups(
      { allowed: true, permissions: getPermissionsForRoles(roles), roles },
      { canManage: true, canManageAssignments: false, canParticipateWhenClosed: false }
    );
    const commands = buildNavigationCommands({ navGroups });
    expect(commands.map((command) => command.href).sort(byText)).toEqual(
      PORTAL_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href)).sort(byText)
    );

    const leave = commands.find((command) => command.href === "/portal/employees-on-leave");
    expect(leave).toMatchObject({ label: "Leave", subtitle: "Me" });
    expect(filterCommands(commands, "employees").map((command) => command.label)).toEqual([
      "Leave",
    ]);
    expect(
      filterCommands(commands, "administration")
        .map((command) => command.label)
        .sort(byText)
    ).toEqual(["Event Photo Booth", "Settings", "Team Directory"]);
  });
});
