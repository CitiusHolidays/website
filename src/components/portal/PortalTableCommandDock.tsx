"use client";

import { Columns3, Info, LayoutPanelTop, RotateCcw, Save, Trash2 } from "lucide-react";
import { type ComponentProps, type ReactElement, useRef, useState } from "react";
import { PortalActionMenu, PortalActionMenuItem } from "@/components/portal/PortalActionMenu";
import { usePortalTableLayout } from "@/components/portal/PortalTableLayoutContext";
import { PortalTooltip } from "@/components/portal/PortalTooltip";
import type { PortalGridColumn, PortalSortState } from "@/lib/portal/portalDataGrid";
import {
  createPortalTableLayoutState,
  normalizePortalTableLayoutState,
  portalTableLayoutsEqual,
} from "@/lib/portal/tableLayoutPresets";

interface PortalTableCommandDockProps<Row> {
  allColumns: readonly PortalGridColumn<Row>[];
  ariaLabel?: string;
  hideableColumns: readonly PortalGridColumn<Row>[];
  onReset: () => void;
  onToggleColumn: (columnId: string) => void;
  scope: null | string;
  sort: PortalSortState | null;
  visibleColumnIds: readonly string[];
}

function effectiveLayoutState<Row>(
  layout: ReturnType<typeof normalizePortalTableLayoutState>,
  columns: readonly PortalGridColumn<Row>[]
) {
  if (!layout) {
    return null;
  }
  const requestedColumnIds = new Set(layout.columns);
  const effectiveColumnIds = columns
    .filter((column) => !column.hideable || requestedColumnIds.has(column.id))
    .map((column) => column.id);
  const sortColumn = layout.sort
    ? columns.find((column) => column.id === layout.sort?.columnId)
    : undefined;
  const effectiveSort =
    layout.sort &&
    sortColumn &&
    (sortColumn.sortValue || sortColumn.semanticValue) &&
    effectiveColumnIds.includes(sortColumn.id)
      ? layout.sort
      : null;
  return createPortalTableLayoutState({
    columns: effectiveColumnIds,
    scope: layout.scope,
    sort: effectiveSort,
  });
}

function LayoutScope({ sharedRole }: { sharedRole?: null | string }) {
  return (
    <span className="text-brand-muted text-xs">
      {sharedRole ? `${sharedRole} role` : "Private"}
    </span>
  );
}

export function PortalTableCommandDock<Row>({
  allColumns,
  ariaLabel = "Table command dock",
  hideableColumns,
  onReset,
  onToggleColumn,
  scope,
  sort,
  visibleColumnIds,
}: PortalTableCommandDockProps<Row>) {
  const layoutContext = usePortalTableLayout();
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [layoutsMenuOpen, setLayoutsMenuOpen] = useState(false);
  const layoutsTriggerRef = useRef<HTMLButtonElement>(null);
  const currentLayout = scope
    ? createPortalTableLayoutState({ columns: visibleColumnIds, scope, sort })
    : null;
  const presetEntries = (layoutContext?.layoutPresets ?? []).map((preset) => {
    const state = normalizePortalTableLayoutState(preset.filterState);
    return { effectiveState: effectiveLayoutState(state, allColumns), preset, state };
  });
  const scopedPresetEntries = currentLayout
    ? presetEntries.filter(({ state }) => state?.scope === currentLayout.scope)
    : [];
  const managedPresetEntries = scopedPresetEntries;
  const matchingPreset = scopedPresetEntries.find(
    ({ effectiveState, preset }) =>
      preset.id === layoutContext?.getActivePresetId(scope) &&
      effectiveState &&
      currentLayout &&
      portalTableLayoutsEqual(currentLayout, effectiveState)
  )?.preset;
  const allColumnsVisible = allColumns.every((column) => visibleColumnIds.includes(column.id));
  const isDefaultLayout = allColumnsVisible && !sort;
  const canReset = !isDefaultLayout || Boolean(matchingPreset);
  const currentLabel =
    matchingPreset?.name ?? (isDefaultLayout ? "Default layout" : "Custom layout");
  const deleteWithStableFocusOrigin = async (
    preset: (typeof managedPresetEntries)[number]["preset"]
  ) => {
    setLayoutsMenuOpen(false);
    await layoutContext?.deleteLayoutPreset(preset, layoutsTriggerRef.current);
  };

  const renderColumnsTrigger = (props: ComponentProps<"button">) => (
    <button
      {...props}
      aria-label={`${ariaLabel}: Columns`}
      className="portal-small-btn min-h-11 bg-white"
      type="button"
    >
      <Columns3 aria-hidden size={14} />
      Columns
    </button>
  );
  const renderLayoutsTrigger = (props: ComponentProps<"button">) => (
    <button
      {...props}
      aria-label={`${ariaLabel}: Presets`}
      className="portal-small-btn min-h-11 bg-white"
      type="button"
    >
      <LayoutPanelTop aria-hidden size={14} />
      Presets
    </button>
  );

  return (
    <section
      aria-label={ariaLabel}
      className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-border bg-brand-light/40 p-2"
      data-testid="portal-table-command-dock"
    >
      <div className="flex min-w-0 items-center gap-1">
        <span
          aria-live="polite"
          className="min-w-0 break-words px-2 font-medium text-brand-muted text-xs"
          data-testid="portal-table-current-layout"
          role="status"
        >
          <span className="sr-only">{ariaLabel}. </span>
          Current: {currentLabel} · {visibleColumnIds.length} of {allColumns.length} columns
        </span>
        <PortalTooltip content="Presets change visible columns and sort only.">
          <button
            aria-label={`${ariaLabel}: About table layout presets`}
            className="grid size-11 shrink-0 place-items-center rounded-lg text-brand-muted hover:bg-white hover:text-citius-blue"
            type="button"
          >
            <Info aria-hidden size={14} />
          </button>
        </PortalTooltip>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <PortalActionMenu
          align="right"
          aria-label={`${ariaLabel}: Optional table columns`}
          header={
            <div>
              <p className="font-semibold text-brand-dark text-sm">Optional columns</p>
              <p className="mt-0.5 text-brand-muted text-xs">Identity and actions always remain.</p>
            </div>
          }
          onOpenChange={setColumnsMenuOpen}
          open={columnsMenuOpen}
          trigger={renderColumnsTrigger}
        >
          {hideableColumns.map((column) => {
            const checked = visibleColumnIds.includes(column.id);
            return (
              <PortalActionMenuItem closeOnClick={false} key={column.id}>
                <button
                  aria-checked={checked}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-brand-dark text-sm hover:bg-brand-light"
                  onClick={() => onToggleColumn(column.id)}
                  role="menuitemcheckbox"
                  type="button"
                >
                  <span>{column.label}</span>
                  <span aria-hidden className="font-semibold text-citius-blue text-xs">
                    {checked ? "Shown" : "Hidden"}
                  </span>
                </button>
              </PortalActionMenuItem>
            );
          })}
        </PortalActionMenu>

        {layoutContext && managedPresetEntries.length > 0 ? (
          <PortalActionMenu
            align="right"
            aria-label={`${ariaLabel}: Table layout presets`}
            header={
              <div>
                <p className="font-semibold text-brand-dark text-sm">Layout presets</p>
                <p className="mt-0.5 text-brand-muted text-xs">
                  Apply presets for this table or remove saved layouts.
                </p>
              </div>
            }
            onOpenChange={setLayoutsMenuOpen}
            open={layoutsMenuOpen}
            trigger={renderLayoutsTrigger}
            triggerRef={layoutsTriggerRef}
          >
            {managedPresetEntries.flatMap(({ preset, state }) => {
              const appliesHere = state?.scope === currentLayout?.scope;
              const checked = appliesHere && matchingPreset?.id === preset.id;
              const items: ReactElement[] = [];
              if (appliesHere) {
                items.push(
                  <PortalActionMenuItem key={`${preset.id}:apply`} label={preset.name}>
                    <button
                      aria-checked={checked}
                      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-brand-dark text-sm hover:bg-brand-light"
                      onClick={() => layoutContext.applyLayoutPreset(preset)}
                      role="menuitemradio"
                      type="button"
                    >
                      <span className="min-w-0 truncate">{preset.name}</span>
                      <LayoutScope sharedRole={preset.sharedRole} />
                    </button>
                  </PortalActionMenuItem>
                );
              }
              if (preset.canMutate) {
                items.push(
                  <PortalActionMenuItem key={`${preset.id}:delete`} label={`Delete ${preset.name}`}>
                    <button
                      className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-red-700 text-sm hover:bg-red-50"
                      onClick={async () => {
                        await deleteWithStableFocusOrigin(preset);
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <Trash2 aria-hidden size={14} />
                      <span className="min-w-0 truncate">Delete {preset.name}</span>
                      {state ? null : (
                        <span className="ml-auto shrink-0 text-brand-muted text-xs">
                          Unavailable
                        </span>
                      )}
                    </button>
                  </PortalActionMenuItem>
                );
              }
              return items;
            })}
          </PortalActionMenu>
        ) : null}

        {layoutContext && currentLayout ? (
          <button
            aria-label={`${ariaLabel}: Save layout`}
            className="portal-small-btn min-h-11 bg-white"
            onClick={() => layoutContext.requestSaveLayout(currentLayout)}
            type="button"
          >
            <Save aria-hidden size={14} />
            Save layout
          </button>
        ) : null}
        <button
          aria-label={`${ariaLabel}: Reset layout`}
          className="portal-small-btn min-h-11 bg-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canReset}
          onClick={() => {
            onReset();
            if (scope) {
              layoutContext?.resetLayout(scope);
            }
          }}
          type="button"
        >
          <RotateCcw aria-hidden size={14} />
          Reset
        </button>
      </div>
    </section>
  );
}
