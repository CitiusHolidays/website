import { getListFilterConfig } from "./listFilterConfig.js";
import { savedViewToUrl } from "./savedViews.js";

const GROUP_ORDER = ["Navigate", "Create", "Recent", "Saved views", "Actions"];

function commandMatches(command, term) {
  const haystack = [command.label, command.subtitle, ...(command.keywords ?? [])]
    .join(" ")
    .toLowerCase();
  return haystack.includes(term.toLowerCase());
}

export function buildNavigationCommands({ navGroups = [], currentPathname = "" } = {}) {
  return navGroups.flatMap((group) =>
    (group.items ?? []).flatMap((item) => {
      if (item.hidden || !item.href) return [];
      return [
        {
          id: `nav:${item.href}`,
          label: item.label,
          subtitle: group.label ?? "Portal",
          keywords: [item.href, group.label],
          icon: item.iconName ?? "Navigation",
          group: "Navigate",
          href: item.href,
          active: item.href === currentPathname,
        },
      ];
    }),
  );
}

export function buildRecentRecordCommands({ navShortcuts = {} } = {}) {
  return Object.entries(navShortcuts).flatMap(([type, rows]) =>
    (rows ?? []).flatMap((row) =>
      row.href
        ? [
            {
              id: `recent:${type}:${row.id ?? row.href}`,
              label: row.label ?? row.title ?? row.code ?? row.href,
              subtitle: row.subtitle ?? type,
              keywords: [type, row.code, row.clientName, row.destination],
              icon: "Clock",
              group: "Recent",
              href: row.href,
            },
          ]
        : [],
    ),
  );
}

export function buildCreateCommands({ has = () => false, openModal } = {}) {
  const specs = [
    ["query", "New query", "manage:queries"],
    ["proposal", "New proposal", "manage:proposals"],
    ["jobCard", "Open Job Card", "manage:jobCards"],
    ["ticket", "New ticket", "manage:ticketing"],
    ["traveller", "New traveller", "manage:travellers"],
    ["expense", "New expense", "create:expenses"],
    ["leave", "New leave request", "request:leave"],
  ];
  return specs.flatMap(([modal, label, permission]) => {
    if (!has(permission) || typeof openModal !== "function") return [];
    return [
      {
        id: `create:${modal}`,
        label,
        subtitle: "Create",
        keywords: [modal, permission],
        icon: "Plus",
        group: "Create",
        run: () => openModal(modal),
      },
    ];
  });
}

export function buildSavedViewCommands({ savedViews = [], applySavedView } = {}) {
  return savedViews.map((savedView) => {
    const href =
      savedView.href ??
      (savedView.pathname
        ? savedViewToUrl(savedView.pathname, savedView, getListFilterConfig(savedView.view))
        : undefined);
    return {
      id: `saved-view:${savedView.id}`,
      label: savedView.name,
      subtitle: savedView.sharedRole ? `${savedView.sharedRole} shared view` : "Saved view",
      keywords: [savedView.view, savedView.pathname, savedView.sharedRole],
      icon: savedView.isFavorite ? "Star" : "Bookmark",
      group: "Saved views",
      href,
      run: typeof applySavedView === "function" ? () => applySavedView(savedView) : undefined,
    };
  });
}

export function filterCommands(commands, term = "") {
  const normalized = term.trim();
  const filtered = normalized
    ? commands.filter((command) => commandMatches(command, normalized))
    : commands;
  return filtered.toSorted((a, b) => {
    const groupDelta = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
    if (groupDelta !== 0) return groupDelta;
    return a.label.localeCompare(b.label);
  });
}
