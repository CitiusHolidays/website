"use client";
import PortalRouteError from "@/components/portal/PortalRouteError";
export default function WorkspaceError({ error, retry }: { error: unknown; retry: () => void }) {
  return <PortalRouteError error={error} retry={retry} />;
}
