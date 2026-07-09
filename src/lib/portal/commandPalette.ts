import { getListFilterConfig } from "./listFilterConfig.js";
import { savedViewToUrl } from "./savedViews.js";

export const COMMAND_GROUP_ORDER = [
  "Navigate",
  "Create",
  "Recent",
  "Saved views",
  "Actions",
] as const;

export type CommandGroup = (typeof COMMAND_GROUP_ORDER)[number] | string;

export interface PortalCommand {
  active?: boolean;
  group: CommandGroup;
  href?: string;
  icon?: string;
  id: string;
  keywords?: Array<string | number | undefined>;
  label: string;
  run?: () => void;
  subtitle?: string;
}

interface NavigationItem {
  hidden?: boolean;
  href?: string;
  iconName?: string;
  label: string;
}

interface NavigationGroup {
  items?: NavigationItem[];
  label?: string;
}

interface BuildNavigationCommandsInput {
  currentPathname?: string;
  navGroups?: NavigationGroup[];
}

interface RecentShortcutRow {
  clientName?: string;
  code?: string;
  destination?: string;
  href?: string;
  id?: string;
  label?: string;
  subtitle?: string;
  title?: string;
}

interface BuildRecentRecordCommandsInput {
  navShortcuts?: Record<string, RecentShortcutRow[] | undefined>;
}

type PermissionChecker = (permission: string) => boolean;
type ModalOpener = (modal: string) => void;

interface BuildCreateCommandsInput {
  has?: PermissionChecker;
  openModal?: ModalOpener;
}

interface SavedViewCommandSource {
  filterState?: Record<string, unknown>;
  href?: string;
  id: string;
  isFavorite?: boolean;
  name: string;
  pathname?: string;
  sharedRole?: string;
  view?: string;
}

interface BuildSavedViewCommandsInput {
  applySavedView?: (savedView: SavedViewCommandSource) => void;
  savedViews?: SavedViewCommandSource[];
}

const CREATE_COMMAND_SPECS = [
  ["query", "New query", "manage:queries"],
  ["proposal", "New proposal", "manage:proposals"],
  ["jobCard", "Open Job Card", "manage:jobCards"],
  ["ticket", "New ticket", "manage:ticketing"],
  ["traveller", "New traveller", "manage:travellers"],
  ["expense", "New expense", "create:expenses"],
  ["leave", "New leave request", "request:leave"],
] as const;

function commandMatches(command: PortalCommand, term: string): boolean {
  const haystack = [command.label, command.subtitle, ...(command.keywords ?? [])]
    .join(" ")
    .toLowerCase();
  return haystack.includes(term.toLowerCase());
}

export function buildNavigationCommands({
  navGroups = [],
  currentPathname = "",
}: BuildNavigationCommandsInput = {}): PortalCommand[] {
  return navGroups.flatMap((group) =>
    (group.items ?? []).flatMap((item) => {
      if (item.hidden || !item.href) {
        return [];
      }
      return [
        {
          active: item.href === currentPathname,
          group: "Navigate",
          href: item.href,
          icon: item.iconName ?? "Navigation",
          id: `nav:${item.href}`,
          keywords: [item.href, group.label],
          label: item.label,
          subtitle: group.label ?? "Portal",
        },
      ];
    })
  );
}

export function buildRecentRecordCommands({
  navShortcuts = {},
}: BuildRecentRecordCommandsInput = {}): PortalCommand[] {
  return Object.entries(navShortcuts).flatMap(([type, rows]) =>
    (rows ?? []).flatMap((row) =>
      row.href
        ? [
            {
              group: "Recent",
              href: row.href,
              icon: "Clock",
              id: `recent:${type}:${row.id ?? row.href}`,
              keywords: [type, row.code, row.clientName, row.destination],
              label: row.label ?? row.title ?? row.code ?? row.href,
              subtitle: row.subtitle ?? type,
            },
          ]
        : []
    )
  );
}

export function buildCreateCommands({
  has = () => false,
  openModal,
}: BuildCreateCommandsInput = {}): PortalCommand[] {
  return CREATE_COMMAND_SPECS.flatMap(([modal, label, permission]) => {
    if (!has(permission) || typeof openModal !== "function") {
      return [];
    }
    return [
      {
        group: "Create",
        icon: "Plus",
        id: `create:${modal}`,
        keywords: [modal, permission],
        label,
        run: () => openModal(modal),
        subtitle: "Create",
      },
    ];
  });
}

export function buildSavedViewCommands({
  savedViews = [],
  applySavedView,
}: BuildSavedViewCommandsInput = {}): PortalCommand[] {
  return savedViews.map((savedView) => {
    const href =
      savedView.href ??
      (savedView.pathname
        ? savedViewToUrl(savedView.pathname, savedView, getListFilterConfig(savedView.view))
        : undefined);
    return {
      group: "Saved views",
      href,
      icon: savedView.isFavorite ? "Star" : "Bookmark",
      id: `saved-view:${savedView.id}`,
      keywords: [savedView.view, savedView.pathname, savedView.sharedRole],
      label: savedView.name,
      run: typeof applySavedView === "function" ? () => applySavedView(savedView) : undefined,
      subtitle: savedView.sharedRole ? `${savedView.sharedRole} shared view` : "Saved view",
    };
  });
}

export function filterCommands(commands: PortalCommand[], term = ""): PortalCommand[] {
  const normalized = term.trim();
  const filtered = normalized
    ? commands.filter((command) => commandMatches(command, normalized))
    : commands;
  return [...filtered].sort((a, b) => {
    const groupDelta =
      COMMAND_GROUP_ORDER.indexOf(a.group as (typeof COMMAND_GROUP_ORDER)[number]) -
      COMMAND_GROUP_ORDER.indexOf(b.group as (typeof COMMAND_GROUP_ORDER)[number]);
    if (groupDelta !== 0) {
      return groupDelta;
    }
    return a.label.localeCompare(b.label);
  });
}
