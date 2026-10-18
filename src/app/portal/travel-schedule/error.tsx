"use client";
import TravelWorkspaceError from "@/components/portal/travel/TravelWorkspaceError";
export default function WorkspaceError({ reset }: { reset: () => void }) {
  return <TravelWorkspaceError reset={reset} />;
}
