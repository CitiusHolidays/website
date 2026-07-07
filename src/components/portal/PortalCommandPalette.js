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
  Bookmark,
  Clock,
  FilterX,
  Navigation,
  Plus,
  Star,
};

const subscribeToClientMount = (onStoreChange) => {
  onStoreChange();
  return () => {};
};
const getClientMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

const initialPaletteState = {
  activeIndex: 0,
  open: false,
  term: "",
};

function paletteReducer(state, action) {
  switch (action.type) {
    case "open":
      return { ...state, open: true };
    case "close":
      return initialPaletteState;
    case "term":
      return { ...state, activeIndex: 0, term: action.term };
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
        currentPathname: workspace.pathname,
        navGroups: workspace.navGroups,
      }),
      ...buildRecentRecordCommands({
        navShortcuts: workspace.navShortcuts,
      }),
      ...buildCreateCommands({
        has: workspace.has,
        openModal: workspace.openModal,
      }),
      ...buildSavedViewCommands({
        applySavedView: workspace.applySavedView,
        savedViews: workspace.savedViews,
      }),
      ...(typeof onSaveView === "function"
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
}

function groupCommands(commands) {
  const groups = [];
  for (const command of commands) {
    const last = groups[groups.length - 1];
    if (last?.label === command.group) {
      last.items.push(command);
    } else {
      groups.push({ items: [command], label: command.group });
    }
  }
  return groups;
}

function CommandPaletteIcon({ name, active }) {
  const IconComponent = COMMAND_ICONS[name] ?? Navigation;
  return (
    <span
      aria-hidden
      className={`grid size-8 shrink-0 place-items-center rounded-lg transition-[background-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] ${
        active ? "bg-citius-blue/12 text-citius-blue" : "bg-brand-light/80 text-brand-muted"
      }`}
    >
      {createElement(IconComponent, { size: 15, strokeWidth: 2 })}
    </span>
  );
}

function CommandPaletteItem({ command, active, onSelect, onHover }) {
  const itemRef = useRef(null);

  useLayoutEffect(() => {
    if (!active) {
      return;
    }
    itemRef.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <button
      className={`group relative w-full rounded-lg px-2 py-1.5 text-left transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.96] ${
        active
          ? "bg-citius-blue/8 text-brand-dark before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-citius-blue"
          : "text-brand-dark hover:bg-brand-light/70"
      }`}
      onClick={onSelect}
      onMouseEnter={onHover}
      ref={itemRef}
      type="button"
    >
      <div className="flex items-center gap-3">
        <CommandPaletteIcon active={active} name={command.icon} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate font-medium font-sans text-sm">{command.label}</span>
            {active ? (
              <kbd className="hidden shrink-0 items-center gap-0.5 rounded border border-brand-border/80 bg-white/90 px-1.5 py-0.5 font-medium font-sans text-[10px] text-brand-muted sm:inline-flex">
                <CornerDownLeft aria-hidden size={10} />
              </kbd>
            ) : null}
          </div>
          {command.subtitle ? (
            <p className="mt-0.5 truncate font-sans text-brand-muted text-xs">{command.subtitle}</p>
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
      aria-label={`Open command palette (${modShortcutLabel})`}
      className={`portal-toolbar-btn border border-brand-border bg-white text-brand-muted transition-[transform,color,background-color,border-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-citius-blue/30 hover:text-citius-blue active:scale-[0.96] ${className}`}
      onClick={() => context?.openPalette()}
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
  if (!(open && mounted)) {
    return null;
  }

  return createPortal(
    <dialog
      aria-label="Command palette"
      className="portal-native-dialog"
      onCancel={(event) => {
        event.preventDefault();
        closePalette();
      }}
      ref={dialogRef}
    >
      <button
        aria-label="Close command palette"
        className="portal-command-backdrop"
        onClick={closePalette}
        style={backdropStyle}
        type="button"
      />
      <div className="portal-command-panel" style={panelStyle}>
        <div className="portal-command-surface pointer-events-auto mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-brand-border/80 bg-white/95 shadow-2xl backdrop-blur-xl">
          <div className="flex shrink-0 items-center gap-2 border-brand-border/80 border-b px-3 py-2">
            <Search aria-hidden className="shrink-0 text-brand-muted" size={16} />
            <input
              aria-label="Search portal commands"
              className="min-w-0 flex-1 bg-transparent py-2 font-sans text-brand-dark text-sm outline-none placeholder:text-brand-muted/70"
              onChange={(event) => {
                dispatchPalette({ term: event.target.value, type: "term" });
              }}
              placeholder="Search commands…"
              ref={inputRef}
              value={term}
            />
            <button
              aria-label="Close"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-brand-muted transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-brand-light hover:text-brand-dark active:scale-[0.96]"
              onClick={closePalette}
              type="button"
            >
              <X size={16} />
            </button>
          </div>
          <div className="portal-command-scroll p-2" onWheel={(event) => event.stopPropagation()}>
            {commands.length === 0 ? (
              <p className="px-3 py-6 text-center font-sans text-brand-muted text-sm">
                No matching commands
              </p>
            ) : (
              groupedWithIndex.map((group) => (
                <div className="mb-1 last:mb-0" key={group.label}>
                  <div className="px-3 pt-2 pb-1 font-sans font-semibold text-[10px] text-brand-muted uppercase tracking-wide">
                    {group.label}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((command, indexInGroup) => {
                      const index = group.start + indexInGroup;
                      const active = index === boundedActiveIndex;
                      return (
                        <CommandPaletteItem
                          active={active}
                          command={command}
                          key={command.id}
                          onHover={() =>
                            dispatchPalette({ activeIndex: index, type: "activeIndex" })
                          }
                          onSelect={() => runCommand(command)}
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
    document.body
  );
}

export function PortalCommandPaletteRoot({ workspace, onSaveView, children }) {
  const [paletteState, dispatchPalette] = useReducer(paletteReducer, initialPaletteState);
  const { open, term, activeIndex } = paletteState;
  const mounted = useSyncExternalStore(
    subscribeToClientMount,
    getClientMountedSnapshot,
    getServerMountedSnapshot
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
    if (!command) {
      return;
    }
    closePalette();
    if (command.run) {
      command.run();
    }
    if (command.href) {
      window.location.assign(command.href);
    }
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
      if (!command) {
        return;
      }
      closeFromKey();
      if (command.run) {
        command.run();
      }
      if (command.href) {
        window.location.assign(command.href);
      }
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
          activeIndex: Math.min(activeIndex + 1, maxActiveIndex),
          type: "activeIndex",
        });
      } else if (open && event.key === "ArrowUp") {
        event.preventDefault();
        dispatchPalette({ activeIndex: Math.max(activeIndex - 1, 0), type: "activeIndex" });
      } else if (open && event.key === "Enter") {
        event.preventDefault();
        runFromKey(commands[boundedActiveIndex]);
      } else if (!open && isTyping) {
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, boundedActiveIndex, commands, maxActiveIndex, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!(open && mounted)) {
      return;
    }
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    return () => {
      if (dialog?.open) {
        dialog.close();
      }
    };
  }, [mounted, open]);

  const contextValue = { openPalette };

  return (
    <PortalCommandPaletteContext.Provider value={contextValue}>
      {children}
      <CommandPaletteOverlay
        backdropStyle={backdropStyle}
        boundedActiveIndex={boundedActiveIndex}
        closePalette={closePalette}
        commands={commands}
        dialogRef={dialogRef}
        dispatchPalette={dispatchPalette}
        groupedWithIndex={groupedWithIndex}
        inputRef={inputRef}
        mounted={mounted}
        open={open}
        panelStyle={panelStyle}
        runCommand={runCommand}
        term={term}
      />
    </PortalCommandPaletteContext.Provider>
  );
}
