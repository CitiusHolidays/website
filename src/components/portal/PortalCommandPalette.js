"use client";

import {
  Bookmark,
  Clock,
  CornerDownLeft,
  FilterX,
  Navigation,
  Plus,
  Search,
  Star,
  X,
} from "lucide-react";
import {
  createContext,
  createElement,
  use,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { usePortalOverlayFrame } from "@/components/portal/usePortalOverlayFrame";
import {
  buildCreateCommands,
  buildNavigationCommands,
  buildRecentRecordCommands,
  buildSavedViewCommands,
  filterCommands,
} from "@/lib/portal/commandPalette";
import { useModShortcutLabel } from "@/lib/portal/shortcutLabels";

const PortalCommandPaletteContext = createContext(null);

const COMMAND_ICONS = {
  Navigation,
  Clock,
  Plus,
  Star,
  Bookmark,
  FilterX,
};

const subscribeToClientMount = (onStoreChange) => {
  onStoreChange();
  return () => {};
};
const getClientMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

const initialPaletteState = {
  open: false,
  term: "",
  activeIndex: 0,
};

function paletteReducer(state, action) {
  switch (action.type) {
    case "open":
      return { ...state, open: true };
    case "close":
      return initialPaletteState;
    case "term":
      return { ...state, term: action.term, activeIndex: 0 };
    case "activeIndex":
      return { ...state, activeIndex: action.activeIndex };
    default:
      return state;
  }
}

function useCommands(workspace, term, onSaveView) {
  return filterCommands(
    [
      ...buildNavigationCommands({
        navGroups: workspace.navGroups,
        currentPathname: workspace.pathname,
      }),
      ...buildRecentRecordCommands({
        navShortcuts: workspace.navShortcuts,
      }),
      ...buildCreateCommands({
        has: workspace.has,
        openModal: workspace.openModal,
      }),
      ...buildSavedViewCommands({
        savedViews: workspace.savedViews,
        applySavedView: workspace.applySavedView,
      }),
      ...(typeof onSaveView === "function"
        ? [
            {
              id: "action:save-view",
              label: "Save current view",
              subtitle: workspace.meta?.title ?? "Portal",
              group: "Actions",
              icon: "Star",
              run: onSaveView,
            },
          ]
        : []),
      {
        id: "action:clear-filters",
        label: "Clear filters",
        subtitle: workspace.meta?.title,
        group: "Actions",
        icon: "FilterX",
        run: workspace.clearAllFilters,
      },
    ],
    term,
  );
}

function groupCommands(commands) {
  const groups = [];
  for (const command of commands) {
    const last = groups[groups.length - 1];
    if (last?.label === command.group) {
      last.items.push(command);
    } else {
      groups.push({ label: command.group, items: [command] });
    }
  }
  return groups;
}

function CommandPaletteIcon({ name, active }) {
  const IconComponent = COMMAND_ICONS[name] ?? Navigation;
  return (
    <span
      className={`grid size-8 shrink-0 place-items-center rounded-lg transition-[background-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] ${
        active ? "bg-citius-blue/12 text-citius-blue" : "bg-brand-light/80 text-brand-muted"
      }`}
      aria-hidden
    >
      {createElement(IconComponent, { size: 15, strokeWidth: 2 })}
    </span>
  );
}

function CommandPaletteItem({
  command,
  active,
  onSelect,
  onHover,
}) {
  const itemRef = useRef(null);

  useLayoutEffect(() => {
    if (!active) return;
    itemRef.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <button
      ref={itemRef}
      type="button"
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`group relative w-full rounded-lg px-2 py-1.5 text-left transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.96] ${
        active
          ? "bg-citius-blue/8 text-brand-dark before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-citius-blue"
          : "text-brand-dark hover:bg-brand-light/70"
      }`}
    >
      <div className="flex items-center gap-3">
        <CommandPaletteIcon name={command.icon} active={active} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate font-sans text-sm font-medium">{command.label}</span>
            {active ? (
              <kbd className="hidden shrink-0 items-center gap-0.5 rounded border border-brand-border/80 bg-white/90 px-1.5 py-0.5 font-sans text-[10px] font-medium text-brand-muted sm:inline-flex">
                <CornerDownLeft size={10} aria-hidden />
              </kbd>
            ) : null}
          </div>
          {command.subtitle ? (
            <p className="mt-0.5 truncate font-sans text-xs text-brand-muted">{command.subtitle}</p>
          ) : null}
        </div>
      </div>
    </button>
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
      type="button"
      onClick={() => context?.openPalette()}
      className={`portal-toolbar-btn border border-brand-border bg-white text-brand-muted transition-[transform,color,background-color,border-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-citius-blue/30 hover:text-citius-blue active:scale-[0.96] ${className}`}
      aria-label={`Open command palette (${modShortcutLabel})`}
    >
      <Search size={15} aria-hidden />
      <kbd className="hidden rounded border border-brand-border/80 bg-brand-light/80 px-1.5 py-0.5 font-sans text-[10px] text-brand-muted sm:inline">
        {modShortcutLabel}
      </kbd>
    </button>
  );
}

function CommandPaletteOverlay({
  open,
  mounted,
  dialogRef,
  backdropStyle,
  panelStyle,
  closePalette,
  inputRef,
  term,
  dispatchPalette,
  commands,
  groupedWithIndex,
  boundedActiveIndex,
  runCommand,
}) {
  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-label="Command palette"
      className="portal-native-dialog"
      onCancel={(event) => {
        event.preventDefault();
        closePalette();
      }}
    >
      <button
        type="button"
        aria-label="Close command palette"
        className="portal-command-backdrop"
        style={backdropStyle}
        onClick={closePalette}
      />
      <div className="portal-command-panel" style={panelStyle}>
        <div className="portal-command-surface pointer-events-auto mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-brand-border/80 bg-white/95 shadow-2xl backdrop-blur-xl">
          <div className="flex shrink-0 items-center gap-2 border-b border-brand-border/80 px-3 py-2">
            <Search size={16} className="shrink-0 text-brand-muted" aria-hidden />
            <input
              ref={inputRef}
              aria-label="Search portal commands"
              value={term}
              onChange={(event) => {
                dispatchPalette({ type: "term", term: event.target.value });
              }}
              placeholder="Search commands…"
              className="min-w-0 flex-1 bg-transparent py-2 font-sans text-sm text-brand-dark outline-none placeholder:text-brand-muted/70"
            />
            <button
              type="button"
              onClick={closePalette}
              aria-label="Close"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-brand-muted transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-brand-light hover:text-brand-dark active:scale-[0.96]"
            >
              <X size={16} />
            </button>
          </div>
          <div
            className="portal-command-scroll p-2"
            onWheel={(event) => event.stopPropagation()}
          >
            {commands.length === 0 ? (
              <p className="px-3 py-6 text-center font-sans text-sm text-brand-muted">
                No matching commands
              </p>
            ) : (
              groupedWithIndex.map((group) => (
                <div key={group.label} className="mb-1 last:mb-0">
                  <div className="px-3 pb-1 pt-2 font-sans text-[10px] font-semibold uppercase tracking-wide text-brand-muted">
                    {group.label}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((command, indexInGroup) => {
                      const index = group.start + indexInGroup;
                      const active = index === boundedActiveIndex;
                      return (
                        <CommandPaletteItem
                          key={command.id}
                          command={command}
                          active={active}
                          onSelect={() => runCommand(command)}
                          onHover={() =>
                            dispatchPalette({ type: "activeIndex", activeIndex: index })
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}

export function PortalCommandPaletteRoot({ workspace, onSaveView, children }) {
  const [paletteState, dispatchPalette] = useReducer(paletteReducer, initialPaletteState);
  const { open, term, activeIndex } = paletteState;
  const mounted = useSyncExternalStore(
    subscribeToClientMount,
    getClientMountedSnapshot,
    getServerMountedSnapshot,
  );
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  const { backdropStyle, panelStyle } = usePortalOverlayFrame();
  const commands = useCommands(workspace, term, onSaveView);
  const grouped = groupCommands(commands);
  const groupedWithIndex = grouped.map((group, groupIndex) => ({
    ...group,
    start: grouped
      .slice(0, groupIndex)
      .reduce((total, previousGroup) => total + previousGroup.items.length, 0),
  }));
  const maxActiveIndex = Math.max(commands.length - 1, 0);
  const boundedActiveIndex = Math.min(activeIndex, maxActiveIndex);

  const closePalette = () => {
    dispatchPalette({ type: "close" });
  };

  const openPalette = () => {
    dispatchPalette({ type: "open" });
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const runCommand = (command) => {
    if (!command) return;
    closePalette();
    if (command.run) command.run();
    if (command.href) window.location.assign(command.href);
  };

  useEffect(() => {
    const closeFromKey = () => {
      dispatchPalette({ type: "close" });
    };
    const openFromKey = () => {
      dispatchPalette({ type: "open" });
      window.setTimeout(() => inputRef.current?.focus(), 0);
    };
    const runFromKey = (command) => {
      if (!command) return;
      closeFromKey();
      if (command.run) command.run();
      if (command.href) window.location.assign(command.href);
    };

    const onKeyDown = (event) => {
      const tagName = event.target?.tagName;
      const isEditable = Boolean(event.target?.isContentEditable);
      const isTyping = isEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(tagName);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) {
          closeFromKey();
        } else {
          openFromKey();
        }
      } else if (event.key === "Escape" && open) {
        event.preventDefault();
        closeFromKey();
      } else if (open && event.key === "ArrowDown") {
        event.preventDefault();
        dispatchPalette({
          type: "activeIndex",
          activeIndex: Math.min(activeIndex + 1, maxActiveIndex),
        });
      } else if (open && event.key === "ArrowUp") {
        event.preventDefault();
        dispatchPalette({ type: "activeIndex", activeIndex: Math.max(activeIndex - 1, 0) });
      } else if (open && event.key === "Enter") {
        event.preventDefault();
        runFromKey(commands[boundedActiveIndex]);
      } else if (!open && isTyping) {
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, boundedActiveIndex, commands, maxActiveIndex, open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !mounted) return;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [mounted, open]);

  const contextValue = { openPalette };

  return (
    <PortalCommandPaletteContext.Provider value={contextValue}>
      {children}
      <CommandPaletteOverlay
        open={open}
        mounted={mounted}
        dialogRef={dialogRef}
        backdropStyle={backdropStyle}
        panelStyle={panelStyle}
        closePalette={closePalette}
        inputRef={inputRef}
        term={term}
        dispatchPalette={dispatchPalette}
        commands={commands}
        groupedWithIndex={groupedWithIndex}
        boundedActiveIndex={boundedActiveIndex}
        runCommand={runCommand}
      />
    </PortalCommandPaletteContext.Provider>
  );
}
