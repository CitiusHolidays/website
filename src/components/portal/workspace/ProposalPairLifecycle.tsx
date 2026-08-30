"use client";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { useState } from "react";
import type { PortalProposalListRow } from "./portalViewTypes";

type ProposalPair = NonNullable<PortalProposalListRow["queryPreview"]>[number];

function formatTimestamp(value?: string | null) {
  if (!value) {
    return "Unknown";
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : "Unknown";
}

function formatEventTimestamp(value: number) {
  return Number.isFinite(value) ? new Date(value).toLocaleString() : "Unknown";
}

function formatDuration(clock: {
  elapsedMs: number | null;
  status: "Complete" | "Running" | "Unknown";
}) {
  if (clock.status === "Unknown" || clock.elapsedMs === null) {
    return "Unknown";
  }
  const hours = Math.floor(clock.elapsedMs / 3_600_000);
  const days = Math.floor(hours / 24);
  const remainderHours = hours % 24;
  const value = days > 0 ? `${days}d ${remainderHours}h` : `${hours}h`;
  return clock.status === "Running" ? `${value} and counting` : value;
}

function ProposalPairTimelineContent({
  pair,
  proposalId,
}: {
  pair: ProposalPair;
  proposalId: string;
}) {
  const [referenceNow] = useState(() => Date.now());
  const queryId = String(pair.id ?? "");
  const timeline = useQuery(
    api.crm.proposals.getPairTimeline,
    queryId ? { proposalId, queryId, referenceNow } : "skip"
  );
  if (!timeline) {
    return <p className="mt-2 text-brand-muted text-xs">Loading timeline…</p>;
  }
  return (
    <div className="mt-3 space-y-3 text-xs">
      <div className="grid gap-1 rounded-lg bg-brand-light/60 p-2 sm:grid-cols-3">
        <span>Handoff → decision: {formatDuration(timeline.clocks.handoffToDecision)}</span>
        <span>Revision → handoff: {formatDuration(timeline.clocks.revisionRequestToHandoff)}</span>
        <span>
          Confirmation → Job Card: {formatDuration(timeline.clocks.confirmationToJobCard)}
        </span>
      </div>
      <div className="rounded-lg bg-brand-light/60 p-2">
        Commercial preflight:{" "}
        {timeline.commercialPreflight.pricingComplete ? "ready" : "pricing incomplete"}; Proposal
        Doc {timeline.commercialPreflight.proposalDocument.toLowerCase()}; exact revision{" "}
        {timeline.commercialPreflight.exactRevisionCurrent ? "current" : "not current"}.
      </div>
      <ol className="space-y-2 border-brand-border border-l pl-3">
        {timeline.events.map((event) => (
          <li key={`${event.type}:${event.at}:${event.revision}:${event.digest ?? event.label}`}>
            <div className="font-medium text-brand-dark">
              {event.type} · revision {event.revision ?? "Unknown"}
            </div>
            <div className="text-brand-muted">
              {formatEventTimestamp(event.at)} · {event.actorName}
            </div>
            <div>{event.label}</div>
            {event.digest ? (
              <div className="font-mono text-[10px] text-brand-muted">
                Digest {event.digest.slice(0, 12)}…
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      {timeline.truncated ? (
        <p className="text-amber-800">Older events are outside this bounded view.</p>
      ) : null}
    </div>
  );
}

function ProposalPairTimeline({ pair, proposalId }: { pair: ProposalPair; proposalId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="rounded-lg border border-brand-border/70 bg-white/70 px-3 py-2"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer font-medium text-citius-blue text-xs">
        Timeline and velocity
      </summary>
      {open ? <ProposalPairTimelineContent pair={pair} proposalId={proposalId} /> : null}
    </details>
  );
}

export function ProposalPairLifecycle({
  canManage,
  onHandoff,
  pair,
  proposalId,
  proposalRevision,
}: {
  canManage: boolean;
  onHandoff: (queryId: string) => void;
  pair: ProposalPair;
  proposalId: string;
  proposalRevision: number;
}) {
  const queryId = String(pair.id ?? "");
  const canHandoff =
    canManage &&
    queryId &&
    pair.handedOffRevision !== proposalRevision &&
    !["Confirmed", "Lost"].includes(pair.pairState ?? "");
  return (
    <div className="space-y-2 rounded-xl border border-brand-border bg-brand-light/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-brand-dark">{pair.queryCode || "Linked Query"}</div>
          <div className="text-brand-muted text-xs">{pair.clientName}</div>
        </div>
        <span className="rounded-full bg-white px-2 py-1 font-medium text-citius-blue text-xs">
          {pair.pairState ?? "Unknown"}
        </span>
      </div>
      <div className="text-brand-muted text-xs">
        Handoff revision {pair.handedOffRevision ?? "None"} · {formatTimestamp(pair.handedOffAt)}
      </div>
      {pair.revisionRequestedAt ? (
        <div className="text-amber-800 text-xs">
          Revision requested {formatTimestamp(pair.revisionRequestedAt)}
        </div>
      ) : null}
      {canHandoff ? (
        <button className="portal-small-btn" onClick={() => onHandoff(queryId)} type="button">
          Review & handoff revision {proposalRevision}
        </button>
      ) : null}
      <ProposalPairTimeline pair={pair} proposalId={proposalId} />
    </div>
  );
}
