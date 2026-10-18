"use client";
import { Button } from "@/components/ui/application-button";
export default function TravelWorkspaceError({ reset }: { reset: () => void }) {
  return (
    <div className="space-y-4 rounded-3xl border border-brand-border bg-white p-6">
      <h1 className="font-heading text-brand-dark text-xl">This page could not be loaded</h1>
      <p className="text-brand-muted text-sm">Check your connection and try again.</p>
      <Button onClick={reset} type="button" variant="primary">
        Try again
      </Button>
    </div>
  );
}
