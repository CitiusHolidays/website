"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  PortalChromeQuickActionSync,
  PortalChromeSavedViewsSync,
} from "@/components/portal/PortalChromeContext";
import { PortalCommandPaletteRoot } from "@/components/portal/PortalCommandPalette";
import { PortalFilterActionsProvider } from "@/components/portal/PortalFilterActions";
import { usePortalChrome } from "@/components/portal/portalChromeState";
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
  PortalRouteLifecycleBoundary,
  renderPortalRoute,
} from "@/components/portal/workspace/portalRouteLifecycle";
import type { SaveCurrentViewOptions } from "@/components/portal/workspace/workspaceStateTypes";
import { PORTAL_PERMISSIONS } from "@/lib/portal/constants";
import { getAccessibleNavGroups } from "@/lib/portal/permissions";
import { resolvePortalRoutePagination } from "@/lib/portal/portalRouteManifest";

const P = PORTAL_PERMISSIONS;

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
  usePortalNotificationDeepLink(workspace);

  return (
    <PortalRouteLifecycleBoundary gate={workspace.gate} view={workspace.view}>
      <PortalWorkspaceLayout workspace={workspace} />
    </PortalRouteLifecycleBoundary>
  );
}

function PortalWorkspaceViews({
  workspace,
}: {
  workspace: ReturnType<typeof usePortalWorkspaceState>;
}) {
  const activePagination = resolvePortalRoutePagination(workspace.view, workspace.pagination);

  return (
    <PortalFilterActionsProvider clearAllFilters={workspace.clearAllFilters}>
      {renderPortalRoute(workspace.view, workspace)}
      <WorkspacePagination pagination={activePagination} />
    </PortalFilterActionsProvider>
  );
}

function PortalWorkspaceLayout({
  workspace,
}: {
  workspace: ReturnType<typeof usePortalWorkspaceState>;
}) {
  const navGroups = getAccessibleNavGroups(workspace.access);
  const { navShortcuts } = usePortalChrome();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savingView, setSavingView] = useState(false);

  return (
    <PortalCommandPaletteRoot
      onSaveView={() => setSaveDialogOpen(true)}
      workspace={{ ...workspace, navGroups, navShortcuts }}
    >
      <div className="mx-auto max-w-[1500px]">
        <PortalChromeSavedViewsSync
          applySavedView={workspace.applySavedView}
          deleteSavedView={async (view) => {
            await workspace.deleteSavedView(view.id);
          }}
          saveCurrentView={async (name, options) => {
            await workspace.saveCurrentView(name, options);
          }}
          savedViews={workspace.savedViews || []}
          toggleSavedViewFavorite={async (view) => {
            await workspace.toggleSavedViewFavorite(view);
          }}
        />
        {workspace.has(P.MANAGE_QUERIES) ? (
          <PortalChromeQuickActionSync
            label="New query"
            onSelect={() => workspace.openModal("query")}
          />
        ) : null}
        <PortalWorkspaceHeader workspace={workspace} />
        <PortalWorkspaceViews workspace={workspace} />
        <PortalWorkspaceSpreadsheetModals workspace={workspace} />
      </div>
      <SaveViewDialog
        onClose={() => setSaveDialogOpen(false)}
        onSave={async (name: string, options?: SaveCurrentViewOptions) => {
          setSavingView(true);
          try {
            await workspace.saveCurrentView(name, options);
            setSaveDialogOpen(false);
            setSavingView(false);
          } catch (error) {
            setSavingView(false);
            throw error;
          }
        }}
        open={saveDialogOpen}
        saving={savingView}
      />
    </PortalCommandPaletteRoot>
  );
}
