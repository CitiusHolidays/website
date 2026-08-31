"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { DocumentPreviewHost } from "@/components/portal/document-preview/DocumentPreviewHost";
import {
  PortalChromeQuickActionSync,
  PortalChromeSavedViewsSync,
} from "@/components/portal/PortalChromeContext";
import { PortalCommandPaletteRoot } from "@/components/portal/PortalCommandPalette";
import { usePortalConfirm } from "@/components/portal/PortalConfirmDialog";
import { PortalFilterActionsProvider } from "@/components/portal/PortalFilterActions";
import { PortalLayoutPresetManager } from "@/components/portal/PortalLayoutPresetManager";
import {
  PortalTableLayoutProvider,
  usePortalTableLayoutRegistry,
} from "@/components/portal/PortalTableLayoutContext";
import { type PortalSavedView, usePortalChrome } from "@/components/portal/portalChromeState";
import SaveViewDialog from "@/components/portal/SaveViewDialog";
import { usePortalNotificationDeepLink } from "@/components/portal/usePortalNotificationDeepLink";
import { PortalWorkspaceSpreadsheetModals } from "@/components/portal/workspace/modals/PortalWorkspaceSpreadsheetModals";
import {
  PortalWorkspaceHeader,
  WorkspacePagination,
} from "@/components/portal/workspace/PortalWorkspaceHeader";
import {
  PortalRouteAccessibility,
  PortalRouteLifecycleBoundary,
} from "@/components/portal/workspace/portalRouteLifecycle";
import type { PortalPaginationSlice } from "@/components/portal/workspace/portalViewTypes";
import type { PortalWorkspaceShellModel } from "@/components/portal/workspace/portalWorkspaceModel";
import type { SaveCurrentViewOptions } from "@/components/portal/workspace/workspaceStateTypes";
import { PORTAL_PERMISSIONS } from "@/lib/portal/constants";
import {
  getAccessibleNavGroups,
  getRolesWithPageAccess,
  hasPermission,
} from "@/lib/portal/permissions";
import {
  createPortalTableLayoutState,
  isPortalTableLayoutPreset,
  normalizePortalTableLayoutState,
  type PortalTableLayoutState,
} from "@/lib/portal/tableLayoutPresets";

const P = PORTAL_PERMISSIONS;
const EMPTY_SAVED_VIEWS: PortalSavedView[] = [];

export function PortalWorkspaceFrame({
  children,
  pagination,
  workspace,
}: {
  children: ReactNode;
  pagination?: PortalPaginationSlice;
  workspace: PortalWorkspaceShellModel;
}) {
  usePortalNotificationDeepLink(workspace.chrome.deepLink);

  return (
    <>
      <PortalRouteAccessibility gate={workspace.lifecycle.gate} view={workspace.lifecycle.view} />
      <PortalRouteLifecycleBoundary gate={workspace.lifecycle.gate} view={workspace.lifecycle.view}>
        <PortalWorkspaceLayout pagination={pagination} workspace={workspace}>
          {children}
        </PortalWorkspaceLayout>
      </PortalRouteLifecycleBoundary>
    </>
  );
}

function PortalWorkspaceLayout({
  children,
  pagination,
  workspace,
}: {
  children: ReactNode;
  pagination?: PortalPaginationSlice;
  workspace: PortalWorkspaceShellModel;
}) {
  const navGroups = getAccessibleNavGroups(workspace.chrome.access);
  const { confirm } = usePortalConfirm();
  const { navShortcuts } = usePortalChrome();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogMode, setSaveDialogMode] = useState<"layout" | "view">("view");
  const [pendingLayout, setPendingLayout] = useState<PortalTableLayoutState | null>(null);
  const {
    acknowledgeLayoutCommand,
    applyLayoutPreset,
    clearActivePreset,
    getActivePresetId,
    getLayoutCommand,
    registryKey,
    resetLayout,
  } = usePortalTableLayoutRegistry(workspace.lifecycle.view);
  const [savingView, setSavingView] = useState(false);
  const openSaveDialog = () => {
    setPendingLayout(null);
    setSaveDialogMode("view");
    setSaveDialogOpen(true);
  };
  const closeSaveDialog = () => {
    setSaveDialogOpen(false);
    setPendingLayout(null);
    setSaveDialogMode("view");
  };
  const deleteSavedView = async (savedView: PortalSavedView) => {
    await workspace.chrome.savedViews.deleteSavedView(savedView.id);
  };
  const saveCurrentView = async (name: string, options?: SaveCurrentViewOptions) => {
    await workspace.chrome.savedViews.saveCurrentView(name, options);
  };
  const toggleSavedViewFavorite = async (savedView: PortalSavedView) => {
    await workspace.chrome.savedViews.toggleSavedViewFavorite(savedView);
  };
  const createQuery = () => workspace.chrome.palette.openModal("query");
  const saveDialogView = async (name: string, options?: SaveCurrentViewOptions) => {
    setSavingView(true);
    try {
      if (saveDialogMode === "layout" && pendingLayout) {
        await workspace.chrome.savedViews.saveCurrentLayout(name, pendingLayout, options);
      } else {
        await workspace.chrome.savedViews.saveCurrentView(name, options);
      }
      setSaveDialogOpen(false);
      setSavingView(false);
    } catch (error) {
      setSavingView(false);
      throw error;
    }
  };
  const deleteManagedSavedItem = async (
    savedItem: PortalSavedView,
    focusOrigin?: HTMLElement | null
  ) => {
    if (!savedItem.canMutate) {
      return;
    }
    const layout = normalizePortalTableLayoutState(savedItem.filterState);
    const taggedLayout = isPortalTableLayoutPreset(savedItem);
    const itemKind = taggedLayout ? "layout" : "saved view";
    const scope = taggedLayout
      ? (layout?.scope ?? "unavailable layout scope")
      : (savedItem.view ?? savedItem.pathname ?? "unavailable view");
    const ownership = savedItem.sharedRole ? `${savedItem.sharedRole} role` : "Private";
    await confirm({
      confirmLabel: `Delete ${itemKind}`,
      danger: true,
      focusOrigin,
      message: `Remove “${savedItem.name}” (${itemKind} · ${scope} · ${ownership})? This does not change records, permissions, or server filters.`,
      onConfirm: async () => {
        await workspace.chrome.savedViews.deleteSavedView(savedItem.id);
        if (taggedLayout) {
          clearActivePreset(savedItem.id);
        }
      },
      title: taggedLayout ? "Delete saved layout?" : "Delete saved view?",
    });
  };
  const deleteLayoutPreset = async (preset: PortalSavedView, focusOrigin?: HTMLElement | null) => {
    await deleteManagedSavedItem(preset, focusOrigin);
  };
  const requestSaveLayout = (
    layout: Pick<PortalTableLayoutState, "columns" | "scope" | "sort">
  ) => {
    setPendingLayout(createPortalTableLayoutState(layout));
    setSaveDialogMode("layout");
    setSaveDialogOpen(true);
  };
  const tableLayoutValue = {
    acknowledgeLayoutCommand,
    applyLayoutPreset,
    deleteLayoutPreset,
    getActivePresetId,
    getLayoutCommand,
    layoutPresets: workspace.chrome.savedViews.layoutPresets,
    registryKey,
    requestSaveLayout,
    resetLayout,
  };

  return (
    <DocumentPreviewHost>
      <PortalCommandPaletteRoot
        onSaveView={openSaveDialog}
        workspace={{
          ...workspace.chrome.palette,
          applyLayoutPreset,
          navGroups,
          navShortcuts,
        }}
      >
        <PortalTableLayoutProvider value={tableLayoutValue}>
          <div className="mx-auto max-w-[1500px]">
            <PortalChromeSavedViewsSync
              applySavedView={workspace.chrome.savedViews.applySavedView}
              deleteSavedView={deleteSavedView}
              saveCurrentView={saveCurrentView}
              savedViews={workspace.chrome.savedViews.savedViews || EMPTY_SAVED_VIEWS}
              toggleSavedViewFavorite={toggleSavedViewFavorite}
            />
            {workspace.chrome.palette.has(P.MANAGE_QUERIES) ? (
              <PortalChromeQuickActionSync label="New query" onSelect={createQuery} />
            ) : null}
            <PortalWorkspaceHeader workspace={workspace.chrome.header} />
            <PortalLayoutPresetManager
              items={workspace.chrome.savedViews.manageableSavedViews}
              onDelete={deleteManagedSavedItem}
              overflowBuckets={workspace.chrome.savedViews.savedViewOverflowBuckets}
            />
            <PortalFilterActionsProvider clearAllFilters={workspace.chrome.header.clearAllFilters}>
              {children}
              <WorkspacePagination pagination={pagination} />
            </PortalFilterActionsProvider>
            <PortalWorkspaceSpreadsheetModals workspace={workspace.modal} />
          </div>
          <SaveViewDialog
            mode={saveDialogMode}
            onClose={closeSaveDialog}
            onSave={saveDialogView}
            open={saveDialogOpen}
            saving={savingView}
            shareableRoles={
              hasPermission(workspace.chrome.access, P.MANAGE_STAFF)
                ? getRolesWithPageAccess(workspace.lifecycle.view)
                : []
            }
          />
        </PortalTableLayoutProvider>
      </PortalCommandPaletteRoot>
    </DocumentPreviewHost>
  );
}
