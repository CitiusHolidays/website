"use client";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import {
  Bookmark,
  Clock,
  CornerDownLeft,
  FilterX,
  LayoutPanelTop,
  Navigation,
  Plus,
  Search,
  Star,
  X,
} from "lucide-react";
import { createContext, createElement, use, useEffect, useRef, useState } from "react";
import { usePortalOverlayFrame } from "@/components/portal/usePortalOverlayFrame";
import { ControlledDialog, ControlledDialogClose } from "@/components/ui/application-dialog";
import { Command } from "@/components/ui/foundation/command";
import {
  buildAuthorizedRecordSearchCommands,
  buildCreateCommands,
  buildLayoutPresetCommands,
  buildNavigationCommands,
  buildRecentRecordCommands,
  buildSavedViewCommands,
  filterCommands,
} from "@/lib/portal/commandPalette";
import { PORTAL_PERMISSIONS } from "@/lib/portal/constants";
import { isSafePortalHref } from "@/lib/portal/savedViews";
import { useModShortcutLabel } from "@/lib/portal/shortcutLabels";
import { isRuntimeFunction } from "../../lib/runtimeValues";

const PortalCommandPaletteContext = createContext(null);

const COMMAND_ICONS = {
  Bookmark,
  Clock,
  FilterX,
  LayoutPanelTop,
  Navigation,
  Plus,
  Star,
};

function navigateToPortalHref(href) {
  if (!isSafePortalHref(href)) {
    return;
  }
  window.location.assign(href);
}

function normalizeRecordSearchTerm(term) {
  return String(term ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 128);
}

function buildAuthorizedRecordSearchResult({
  canSearchJobCards,
  canSearchQueries,
  canSearchRecords,
  current,
  eligible,
  jobCardPage,
  jobCardReady,
  queryPage,
  queryReady,
  readiness,
}) {
  if (!eligible) {
    return { active: false, busy: false, commands: [], status: null };
  }
  if (!canSearchRecords) {
    return { active: true, busy: false, commands: [], status: null };
  }
  if (!current || readiness === undefined) {
    return {
      active: true,
      busy: true,
      commands: [],
      status: "Searching authorized records…",
    };
  }

  const waitingForReadyResult =
    (queryReady && queryPage === undefined) || (jobCardReady && jobCardPage === undefined);
  const preparing =
    (canSearchQueries && readiness.tables?.queries !== true) ||
    (canSearchJobCards && readiness.tables?.jobCards !== true);
  const commands = buildAuthorizedRecordSearchCommands({
    jobCards: jobCardPage?.page ?? [],
    queries: queryPage?.page ?? [],
  });
  if (waitingForReadyResult && commands.length === 0) {
    return {
      active: true,
      busy: true,
      commands,
      status: "Searching authorized records…",
    };
  }
  let status = null;
  if (preparing) {
    status = "Some authorized record search is preparing.";
  } else if (waitingForReadyResult) {
    status = "Searching authorized records…";
  }
  return {
    active: true,
    busy: waitingForReadyResult || preparing,
    commands,
    status,
  };
}

function useAuthorizedRecordSearch(workspace, open, term) {
  const normalizedTerm = normalizeRecordSearchTerm(term);
  const eligible = open && normalizedTerm.length >= 2;
  const [debouncedTerm, setDebouncedTerm] = useState("");

  useEffect(() => {
    if (!eligible) {
      setDebouncedTerm("");
      return;
    }
    setDebouncedTerm("");
    const timer = setTimeout(() => setDebouncedTerm(normalizedTerm), 200);
    return () => clearTimeout(timer);
  }, [eligible, normalizedTerm]);

  const current = eligible && debouncedTerm === normalizedTerm;
  const canSearchQueries = Boolean(workspace.has?.(PORTAL_PERMISSIONS.VIEW_QUERIES));
  const canSearchJobCards = Boolean(workspace.has?.(PORTAL_PERMISSIONS.VIEW_JOB_CARDS));
  const canSearchRecords = canSearchQueries || canSearchJobCards;
  const readiness = useQuery(
    api.crm.listSearch.getReadiness,
    current && canSearchRecords ? {} : "skip"
  );
  const queryReady = current && canSearchQueries && readiness?.tables?.queries === true;
  const jobCardReady = current && canSearchJobCards && readiness?.tables?.jobCards === true;
  const queryPage = useQuery(
    api.crm.queries.listPage,
    queryReady ? { paginationOpts: { cursor: null, numItems: 12 }, search: debouncedTerm } : "skip"
  );
  const jobCardPage = useQuery(
    api.crm.jobCards.listPage,
    jobCardReady
      ? { paginationOpts: { cursor: null, numItems: 12 }, search: debouncedTerm }
      : "skip"
  );
  return buildAuthorizedRecordSearchResult({
    canSearchJobCards,
    canSearchQueries,
    canSearchRecords,
    current,
    eligible,
    jobCardPage,
    jobCardReady,
    queryPage,
    queryReady,
    readiness,
  });
}

function useCommands(workspace, term, onSaveView, recordSearch) {
  const localCommands = filterCommands(
    [
      ...buildNavigationCommands({
        currentPathname: workspace.pathname,
        navGroups: workspace.navGroups,
      }),
      ...(recordSearch.active
        ? []
        : buildRecentRecordCommands({ navShortcuts: workspace.navShortcuts })),
      ...buildCreateCommands({
        has: workspace.has,
        openModal: workspace.openModal,
      }),
      ...buildSavedViewCommands({
        applySavedView: workspace.applySavedView,
        savedViews: workspace.savedViews,
      }),
      ...buildLayoutPresetCommands({
        applyLayoutPreset: workspace.applyLayoutPreset,
        layoutPresets: workspace.layoutPresets,
      }),
      ...(isRuntimeFunction(onSaveView)
        ? [
            {
              group: "Actions",
              icon: "Star",
              id: "action:save-view",
              label: "Save current view",
              run: onSaveView,
              subtitle: workspace.meta?.title ?? "Portal",
            },
          ]
        : []),
      {
        group: "Actions",
        icon: "FilterX",
        id: "action:clear-filters",
        label: "Clear filters",
        run: workspace.clearAllFilters,
        subtitle: workspace.meta?.title,
      },
    ],
    term
  );
  return filterCommands([...localCommands, ...recordSearch.commands], "");
}

function groupCommands(commands) {
  const groups = [];
  for (const command of commands) {
    const last = groups.at(-1);
    if (last?.label === command.group) {
      last.items.push(command);
    } else {
      groups.push({ items: [command], label: command.group });
    }
  }
  return groups;
}

function CommandPaletteIcon({ name }) {
  const IconComponent = COMMAND_ICONS[name] ?? Navigation;
  return (
    <span
      aria-hidden
      className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-light/80 text-brand-muted group-data-[selected=true]:bg-citius-blue/12 group-data-[selected=true]:text-citius-blue"
    >
      {createElement(IconComponent, { size: 15, strokeWidth: 2 })}
    </span>
  );
}

function CommandPaletteItem({ command, runCommand }) {
  const handleSelect = () => runCommand(command);

  return (
    <Command.Item
      className="group relative w-full cursor-default rounded-lg px-2 py-1.5 text-left text-brand-dark outline-none hover:bg-brand-light/70 active:scale-[0.96] data-[selected=true]:bg-citius-blue/8"
      onSelect={handleSelect}
      value={command.id}
    >
      <span className="pointer-events-none absolute inset-y-1 left-0 hidden w-0.5 rounded-full bg-citius-blue group-data-[selected=true]:block" />
      <div className="relative flex items-center gap-3">
        <CommandPaletteIcon name={command.icon} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate font-medium font-sans text-sm">{command.label}</span>
            <kbd className="hidden shrink-0 items-center gap-0.5 rounded border border-brand-border/80 bg-white/90 px-1.5 py-0.5 font-medium font-sans text-[10px] text-brand-muted group-data-[selected=true]:sm:inline-flex">
              <CornerDownLeft aria-hidden size={10} />
            </kbd>
          </div>
          {command.subtitle ? (
            <p className="mt-0.5 truncate font-sans text-brand-muted text-xs">{command.subtitle}</p>
          ) : null}
        </div>
      </div>
    </Command.Item>
  );
}

export function usePortalCommandPalette() {
  return use(PortalCommandPaletteContext);
}

export function PortalCommandPaletteTrigger({ className = "" }) {
  const context = usePortalCommandPalette();
  const modShortcutLabel = useModShortcutLabel();

  return (
    <button
      aria-label={`Open command palette (${modShortcutLabel})`}
      className={`portal-toolbar-btn border border-brand-border bg-white text-brand-muted transition-[scale,color,background-color,border-color] duration-150 ease-[var(--portal-ease-out)] hover:border-citius-blue/30 hover:text-citius-blue active:scale-[0.96] ${className}`}
      onClick={context?.openPalette}
      type="button"
    >
      <Search aria-hidden size={15} />
      <kbd className="hidden rounded border border-brand-border/80 bg-brand-light/80 px-1.5 py-0.5 font-sans text-[10px] text-brand-muted sm:inline">
        {modShortcutLabel}
      </kbd>
    </button>
  );
}

function CommandPaletteOverlay({
  open,
  frameStyle,
  backdropStyle,
  panelStyle,
  handleOpenChange,
  inputRef,
  term,
  onTermChange,
  grouped,
  searchBusy,
  searchStatus,
  runCommand,
}) {
  return (
    <ControlledDialog
      backdropClassName="portal-command-backdrop"
      backdropStyle={backdropStyle}
      initialFocus={inputRef}
      onOpenChange={handleOpenChange}
      open={open}
      panelClassName="portal-command-panel"
      panelStyle={panelStyle}
      popupClassName="material-floating portal-command-surface pointer-events-auto mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-brand-border/80 bg-white/95 shadow-2xl backdrop-blur-xl"
      popupRender={<Command aria-label="Command palette" shouldFilter={false} />}
      triggerless
      viewportClassName="portal-command-overlay"
      viewportStyle={frameStyle}
    >
      <div className="flex shrink-0 items-center gap-2 border-brand-border/80 border-b px-3 py-2">
        <Search aria-hidden className="shrink-0 text-brand-muted" size={16} />
        <Command.Input
          aria-label="Search portal commands"
          className="min-w-0 flex-1 bg-transparent py-2 font-sans text-base text-brand-dark outline-none placeholder:text-brand-muted/70 sm:text-sm"
          onValueChange={onTermChange}
          placeholder="Search pages, actions, and authorized records…"
          ref={inputRef}
          value={term}
        />
        <ControlledDialogClose
          aria-label="Close"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-brand-muted transition-[background-color,color,transform] duration-150 ease-[var(--portal-ease-out)] hover:bg-brand-light hover:text-brand-dark active:scale-[0.96]"
          type="button"
        >
          <X size={16} />
        </ControlledDialogClose>
      </div>
      <Command.List
        aria-busy={searchBusy || undefined}
        className="portal-command-scroll p-2"
        onWheel={stopWheelPropagation}
      >
        {searchStatus ? (
          <div
            aria-live="polite"
            className="px-3 py-2 font-sans text-brand-muted text-xs"
            role="status"
          >
            {searchStatus}
          </div>
        ) : null}
        <Command.Empty className="px-3 py-6 text-center font-sans text-brand-muted text-sm">
          No matching commands
        </Command.Empty>
        {grouped.map((group) => (
          <Command.Group
            className="mb-1 last:mb-0 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:font-sans [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-brand-muted [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-items]]:space-y-0.5"
            heading={group.label}
            key={group.label}
          >
            {group.items.map((command) => (
              <CommandPaletteItem command={command} key={command.id} runCommand={runCommand} />
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </ControlledDialog>
  );
}

export function PortalCommandPaletteRoot({ workspace, onSaveView, children }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const inputRef = useRef(null);
  const { backdropStyle, frameStyle, panelStyle } = usePortalOverlayFrame({ open });
  const recordSearch = useAuthorizedRecordSearch(workspace, open, term);
  const commands = useCommands(workspace, term, onSaveView, recordSearch);
  const grouped = groupCommands(commands);

  const closePalette = () => {
    setOpen(false);
    setTerm("");
  };

  const openPalette = () => setOpen(true);

  const handleOpenChange = (nextOpen) => {
    if (nextOpen) {
      openPalette();
    } else {
      closePalette();
    }
  };

  const runCommand = (command) => {
    if (!command) {
      return;
    }
    closePalette();
    if (command.run) {
      command.run();
    }
    if (command.href) {
      navigateToPortalHref(command.href);
    }
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) {
          setOpen(false);
          setTerm("");
        } else {
          setOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const contextValue = { openPalette };

  return (
    <PortalCommandPaletteContext.Provider value={contextValue}>
      {children}
      <CommandPaletteOverlay
        backdropStyle={backdropStyle}
        frameStyle={frameStyle}
        grouped={grouped}
        handleOpenChange={handleOpenChange}
        inputRef={inputRef}
        onTermChange={setTerm}
        open={open}
        panelStyle={panelStyle}
        runCommand={runCommand}
        searchBusy={recordSearch.busy}
        searchStatus={recordSearch.status}
        term={term}
      />
    </PortalCommandPaletteContext.Provider>
  );
}

function stopWheelPropagation(event) {
  event.stopPropagation();
}
