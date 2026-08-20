"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
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
import { usePortalWorkspaceState } from "@/components/portal/usePortalWorkspaceState";
import { PortalWorkspaceSpreadsheetModals } from "@/components/portal/workspace/modals/PortalWorkspaceSpreadsheetModals";
import {
  PortalWorkspaceHeader,
  WorkspacePagination,
} from "@/components/portal/workspace/PortalWorkspaceHeader";
import { LoadingPanel } from "@/components/portal/workspace/portalAdminHelpers";
import {
  PortalRouteAccessibility,
  PortalRouteLifecycleBoundary,
  renderPortalRoute,
} from "@/components/portal/workspace/portalRouteLifecycle";
import type { PortalWorkspaceModel } from "@/components/portal/workspace/portalWorkspaceModel";
import type { SaveCurrentViewOptions } from "@/components/portal/workspace/workspaceStateTypes";
import { PORTAL_PERMISSIONS } from "@/lib/portal/constants";
import { getAccessibleNavGroups } from "@/lib/portal/permissions";

const P = PORTAL_PERMISSIONS;
const EMPTY_SAVED_VIEWS: PortalSavedView[] = [];

export default function PortalWorkspace(props: { view?: string }) {
  return (
    <Suspense fallback={<LoadingPanel />}>
      <PortalWorkspaceInner {...props} />
    </Suspense>
  );
}

function PortalWorkspaceInner({ view = "dashboard" }: { view?: string }) {
  const searchParams = useSearchParams();
  const workspace = usePortalWorkspaceState(view, searchParams);
  usePortalNotificationDeepLink(workspace.chrome.deepLink);

  return (
    <>
      <PortalRouteAccessibility gate={workspace.lifecycle.gate} view={workspace.lifecycle.view} />
      <PortalRouteLifecycleBoundary gate={workspace.lifecycle.gate} view={workspace.lifecycle.view}>
        <PortalWorkspaceLayout workspace={workspace} />
      </PortalRouteLifecycleBoundary>
    </>
  );
}

function PortalWorkspaceViews({ workspace }: { workspace: PortalWorkspaceModel }) {
  return (
    <PortalFilterActionsProvider clearAllFilters={workspace.chrome.header.clearAllFilters}>
      {renderPortalRoute(workspace.route)}
      <WorkspacePagination pagination={workspace.route.pagination} />
    </PortalFilterActionsProvider>
  );
}

function PortalWorkspaceLayout({ workspace }: { workspace: PortalWorkspaceModel }) {
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
        <PortalWorkspaceViews workspace={workspace} />
        <PortalWorkspaceSpreadsheetModals workspace={workspace.modal} />
      </div>
      <SaveViewDialog
        onClose={closeSaveDialog}
        onSave={saveDialogView}
        open={saveDialogOpen}
        saving={savingView}
      />
      <DocumentPreviewHost />
    </PortalCommandPaletteRoot>
  );
}
