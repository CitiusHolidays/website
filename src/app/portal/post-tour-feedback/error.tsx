"use client";

import { Button } from "@/components/ui/application-button";

export default function FeedbackError({ reset }: { reset: () => void }) {
  return (
    <div className="space-y-4 rounded-lg border border-brand-border bg-white p-5">
      <h1 className="font-heading text-brand-dark text-xl">Feedback could not be loaded</h1>
      <p className="text-brand-muted text-sm">
        Check your connection and try again. If this link is old, open Post-tour feedback from the
        menu.
      </p>
      <Button onClick={reset} surface="staff" type="button" variant="primary">
        Try again
      </Button>
    </div>
  );
}
