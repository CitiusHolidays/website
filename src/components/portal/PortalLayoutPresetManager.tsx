"use client";

import { LayoutPanelTop, Trash2 } from "lucide-react";
import { type ComponentProps, useRef, useState } from "react";
import { PortalActionMenu, PortalActionMenuItem } from "@/components/portal/PortalActionMenu";
import type {
  SavedViewOverflowBucket,
  SavedViewRecord,
} from "@/components/portal/workspace/workspaceStateTypes";
import {
  isPortalTableLayoutPreset,
  normalizePortalTableLayoutState,
} from "@/lib/portal/tableLayoutPresets";

interface PortalLayoutPresetManagerProps {
  items: readonly SavedViewRecord[];
  onDelete: (item: SavedViewRecord, focusOrigin?: HTMLElement | null) => Promise<void>;
  overflowBuckets: readonly SavedViewOverflowBucket[];
}

export function PortalLayoutPresetManager({
  items,
  onDelete,
  overflowBuckets,
}: PortalLayoutPresetManagerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const managedItems = items.filter((item) => item.canMutate);
  if (managedItems.length === 0 && overflowBuckets.length === 0) {
    return null;
  }

  const renderTrigger = (props: ComponentProps<"button">) => (
    <button
      {...props}
      aria-label="Manage saved views and table layouts"
      className="portal-small-btn min-h-11 bg-white"
      type="button"
    >
      <LayoutPanelTop aria-hidden size={14} />
      Manage saved views
    </button>
  );

  return (
    <div className="flex justify-end px-3 pb-2 sm:px-5 lg:px-6">
      <PortalActionMenu
        align="right"
        aria-label="Saved view and table layout management"
        header={
          <div>
            <p className="font-semibold text-brand-dark text-sm">Saved views and layouts</p>
            <p className="mt-0.5 text-brand-muted text-xs">
              Remove saved presentation choices without changing records or permissions.
            </p>
          </div>
        }
        onOpenChange={setOpen}
        open={open}
        trigger={renderTrigger}
        triggerRef={triggerRef}
      >
        {managedItems.map((item) => {
          const state = normalizePortalTableLayoutState(item.filterState);
          const taggedLayout = isPortalTableLayoutPreset(item);
          const itemKind = taggedLayout ? "Table layout" : "Saved view";
          const itemScope = taggedLayout
            ? (state?.scope ?? "Unavailable layout scope")
            : (item.view ?? item.pathname ?? "Unavailable view");
          const ownership = item.sharedRole ? `${item.sharedRole} role` : "Private";
          return (
            <PortalActionMenuItem
              key={item.id}
              label={`Delete ${item.name}, ${itemKind}, ${itemScope}, ${ownership}`}
            >
              <button
                className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-red-700 text-sm hover:bg-red-50"
                onClick={async () => {
                  setOpen(false);
                  await onDelete(item, triggerRef.current);
                }}
                role="menuitem"
                type="button"
              >
                <Trash2 aria-hidden className="shrink-0" size={14} />
                <span className="min-w-0 break-words">
                  Delete {item.name}
                  <span className="mt-0.5 block text-brand-muted text-xs">
                    {itemKind} · {itemScope} · {ownership}
                  </span>
                </span>
              </button>
            </PortalActionMenuItem>
          );
        })}
        {overflowBuckets.map((bucket) => (
          <PortalActionMenuItem
            disabled
            key={`${bucket.kind}:${bucket.sharedRole ?? "private"}`}
            label={`More saved items available in ${bucket.label}`}
          >
            <div className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900 text-xs" role="status">
              More saved items exist in {bucket.label}.{" "}
              {bucket.canDelete
                ? "Delete a visible item from this bucket to reveal the next one."
                : "Ask a saved-view manager to remove one from this bucket to reveal the next one."}
            </div>
          </PortalActionMenuItem>
        ))}
      </PortalActionMenu>
    </div>
  );
}
