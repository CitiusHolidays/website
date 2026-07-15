"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
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
import type { PortalSpreadsheetModalWorkspaceSlice } from "@/components/portal/workspace/modals/portalSpreadsheetModalTypes";
import {
  PortalWorkspaceHeader,
  type PortalWorkspaceHeaderSlice,
  WorkspacePagination,
} from "@/components/portal/workspace/PortalWorkspaceHeader";
import { LoadingPanel } from "@/components/portal/workspace/portalAdminHelpers";
import { renderPortalView } from "@/components/portal/workspace/portalViewRegistry";
import {
  buildPortalViewRegistryInputs,
  resolveViewPagination,
} from "@/components/portal/workspace/portalViewRegistryInputs";
import type {
  SaveCurrentViewOptions,
  SavedViewRecord,
} from "@/components/portal/workspace/workspaceStateTypes";
import { PORTAL_PERMISSIONS } from "@/lib/portal/constants";
import { getAccessibleNavGroups } from "@/lib/portal/permissions";

const P = PORTAL_PERMISSIONS;

export default function PortalWorkspace(props: { view?: string }) {
  return (
    <Suspense fallback={<LoadingPanel />}>
      <PortalWorkspaceInner key={props.view || "dashboard"} {...props} />
    </Suspense>
  );
}

function PortalWorkspaceInner({ view = "dashboard" }: { view?: string }) {
  const searchParams = useSearchParams();
  const workspace = usePortalWorkspaceState(view, searchParams);
  usePortalNotificationDeepLink(workspace);

  if (workspace.gate === "loading") {
    return <LoadingPanel />;
  }

  if (workspace.gate === "denied") {
    return (
      <div className="rounded-2xl border border-brand-border bg-white p-8 shadow-sm">
        <div className="font-heading font-semibold text-citius-blue text-xl">
          No access to this portal page
        </div>
        <p className="mt-2 text-brand-muted text-sm">
          Your account is signed in, but your staff role does not include this module.
        </p>
      </div>
    );
  }

  return <PortalWorkspaceLayout workspace={workspace} />;
}

function PortalWorkspaceViews({
  workspace,
}: {
  workspace: ReturnType<typeof usePortalWorkspaceState>;
}) {
  const activePagination = resolveViewPagination(workspace.view, workspace.pagination);

  return (
    <PortalFilterActionsProvider clearAllFilters={workspace.clearAllFilters}>
      {renderPortalView(buildPortalViewRegistryInputs(workspace))}
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
          applySavedView={(view) => workspace.applySavedView(view as unknown as SavedViewRecord)}
          deleteSavedView={async (view) => {
            await workspace.deleteSavedView(view.id);
          }}
          saveCurrentView={async (name, options) => {
            await workspace.saveCurrentView(name, options as SaveCurrentViewOptions);
          }}
          savedViews={(workspace.savedViews || []) as unknown as PortalSavedView[]}
          toggleSavedViewFavorite={async (view) => {
            await workspace.toggleSavedViewFavorite(view as unknown as SavedViewRecord);
          }}
        />
        {workspace.has(P.MANAGE_QUERIES) ? (
          <PortalChromeQuickActionSync
            label="New query"
            onSelect={() => workspace.openModal("query")}
          />
        ) : null}
        <PortalWorkspaceHeader workspace={workspace as unknown as PortalWorkspaceHeaderSlice} />
        <PortalWorkspaceViews workspace={workspace} />
        <PortalWorkspaceSpreadsheetModals
          workspace={workspace as unknown as PortalSpreadsheetModalWorkspaceSlice}
        />
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
