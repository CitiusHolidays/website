"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { DocumentPreviewHost } from "@/components/portal/document-preview/DocumentPreviewHost";
import {
  PortalChromeQuickActionSync,
  PortalChromeSavedViewsSync,
} from "@/components/portal/PortalChromeContext";
import { PortalCommandPaletteRoot } from "@/components/portal/PortalCommandPalette";
import { PortalFilterActionsProvider } from "@/components/portal/PortalFilterActions";
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
import { getAccessibleNavGroups } from "@/lib/portal/permissions";

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
  const { navShortcuts } = usePortalChrome();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savingView, setSavingView] = useState(false);
  const openSaveDialog = () => setSaveDialogOpen(true);
  const closeSaveDialog = () => setSaveDialogOpen(false);
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
      await workspace.chrome.savedViews.saveCurrentView(name, options);
      setSaveDialogOpen(false);
      setSavingView(false);
    } catch (error) {
      setSavingView(false);
      throw error;
    }
  };

  return (
    <DocumentPreviewHost>
      <PortalCommandPaletteRoot
        onSaveView={openSaveDialog}
        workspace={{ ...workspace.chrome.palette, navGroups, navShortcuts }}
      >
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
          <PortalFilterActionsProvider clearAllFilters={workspace.chrome.header.clearAllFilters}>
            {children}
            <WorkspacePagination pagination={pagination} />
          </PortalFilterActionsProvider>
          <PortalWorkspaceSpreadsheetModals workspace={workspace.modal} />
        </div>
        <SaveViewDialog
          onClose={closeSaveDialog}
          onSave={saveDialogView}
          open={saveDialogOpen}
          saving={savingView}
        />
      </PortalCommandPaletteRoot>
    </DocumentPreviewHost>
  );
}
