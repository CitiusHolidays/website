"use client";

import Link from "next/link";
import { Button } from "@/components/ui/application-button";
import { buttonVariants } from "@/components/ui/application-button-variants";
import { classifyPortalRouteError } from "@/lib/portal/portalRouteError";

const COPY = {
  forbidden: {
    body: "Your staff role does not include this page or record. If you were signed out, sign in again.",
    title: "You do not have access to this",
  },
  missing: {
    body: "It may have been removed, or the link is incomplete.",
    title: "This record could not be found",
  },
  unavailable: {
    body: "Check your connection and try again.",
    title: "This page could not be loaded",
  },
} as const;

/**
 * The Staff Workspace error panel. It renders inside the portal shell, so it uses the same card
 * as the "no access" route panel and always offers a way back to the workspace.
 */
export default function PortalRouteError({ error, retry }: { error: unknown; retry?: () => void }) {
  const kind = classifyPortalRouteError(error);
  const copy = COPY[kind];
  return (
    <div
      className="rounded-2xl border border-brand-border bg-white p-8 shadow-sm"
      data-portal-route-error={kind}
      role="alert"
    >
      <h2 className="font-heading font-semibold text-citius-blue text-xl">{copy.title}</h2>
      <p className="mt-2 text-brand-muted text-sm">{copy.body}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {kind === "unavailable" && retry ? (
          <Button onClick={() => retry()} type="button" variant="primary">
            Try again
          </Button>
        ) : null}
        <Link
          className={buttonVariants({ variant: kind === "unavailable" ? "outline" : "primary" })}
          href="/portal"
        >
          Go to your workspace
        </Link>
        {kind === "forbidden" ? (
          <a className={buttonVariants({ variant: "outline" })} href="/auth/connect">
            Sign in again
          </a>
        ) : null}
      </div>
    </div>
  );
}
