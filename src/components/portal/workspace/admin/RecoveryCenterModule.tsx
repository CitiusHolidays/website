"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { usePortalWorkspaceShellState } from "@/components/portal/usePortalWorkspaceState";
import { PortalWorkspaceFrame } from "@/components/portal/workspace/PortalWorkspaceFrame";
import { LoadingPanel, PortalViewLoading } from "@/components/portal/workspace/portalAdminHelpers";

const RecoveryCenterView = dynamic(
  () => import("./RecoveryCenterView").then((module) => module.RecoveryCenterView),
  { loading: PortalViewLoading }
);

export function RecoveryCenterModule() {
  return (
    <Suspense fallback={<LoadingPanel />}>
      <RecoveryCenterModuleInner />
    </Suspense>
  );
}

function RecoveryCenterModuleInner() {
  const searchParams = useSearchParams();
  const workspace = usePortalWorkspaceShellState("recovery", searchParams);

  return (
    <PortalWorkspaceFrame workspace={workspace}>
      <RecoveryCenterView access={workspace.chrome.access ?? {}} />
    </PortalWorkspaceFrame>
  );
}
