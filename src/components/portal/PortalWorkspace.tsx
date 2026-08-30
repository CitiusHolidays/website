"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { usePortalWorkspaceState } from "@/components/portal/usePortalWorkspaceState";
import { PortalWorkspaceFrame } from "@/components/portal/workspace/PortalWorkspaceFrame";
import { LoadingPanel } from "@/components/portal/workspace/portalAdminHelpers";
import { renderPortalRoute } from "@/components/portal/workspace/portalRouteLifecycle";

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

  return (
    <PortalWorkspaceFrame pagination={workspace.route.pagination} workspace={workspace}>
      {renderPortalRoute(workspace.route)}
    </PortalWorkspaceFrame>
  );
}
