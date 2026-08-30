"use client";

import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import {
  inboundBriefContactWindowLabel,
  inboundBriefDateFlexibilityLabel,
  inboundBriefServiceLabel,
} from "@/lib/contact/inboundIntentContract";
import { formatConvexError } from "./portalWorkspaceListHelpers";

interface MiceProposalDocDraftProps {
  canApproveSend: boolean;
  canManage: boolean;
  proposalId: string;
  proposalRevision: number;
  queryId: string;
}

type DraftState = NonNullable<FunctionReturnType<typeof api.crm.proposals.getMiceDocDraft>>;
type MiceDraft = NonNullable<DraftState["draft"]>;
type MiceTransition = FunctionReturnType<typeof api.crm.proposals.createMiceDocDraft>;

function formatTimestamp(value: number) {
  return Number.isFinite(value) ? new Date(value).toLocaleString() : "Unknown";
}

function briefRows(brief: DraftState["source"]["brief"]) {
  return [
    ["Programme", inboundBriefServiceLabel(brief.serviceType)],
    ["Destination or programme", brief.destination],
    ["Preferred travel date", brief.travelStartDate],
    ["Date flexibility", inboundBriefDateFlexibilityLabel(brief.dateFlexibility)],
    ["Approximate group size", brief.paxCount ? String(brief.paxCount) : ""],
    ["Best contact window", inboundBriefContactWindowLabel(brief.contactWindow)],
  ].filter((row): row is [string, string] => Boolean(row[1]));
}

function statusLabel(status: MiceDraft["status"]) {
  if (status === "approved_for_manual_send") {
    return "Approved for manual send";
  }
  if (status === "reviewed") {
    return "Human reviewed";
  }
  return "Draft";
}

function MiceProposalDocDraftContent({
  canApproveSend,
  canManage,
  proposalId,
  proposalRevision,
  queryId,
}: MiceProposalDocDraftProps) {
  const args = { proposalId, proposalRevision, queryId };
  const state = useQuery(api.crm.proposals.getMiceDocDraft, args);
  const createDraft = useMutation(api.crm.proposals.createMiceDocDraft);
  const markReviewed = useMutation(api.crm.proposals.markMiceDocDraftReviewed);
  const approveForManualSend = useMutation(api.crm.proposals.approveMiceDocDraftForManualSend);
  const [announcement, setAnnouncement] = useState("");
  const [pending, setPending] = useState(false);

  const run = async (command: (input: typeof args) => Promise<MiceTransition>, success: string) => {
    setPending(true);
    setAnnouncement("");
    try {
      await command(args);
      setAnnouncement(success);
    } catch (error) {
      setAnnouncement(formatConvexError(error, "Unable to update the Proposal Doc draft."));
    } finally {
      setPending(false);
    }
  };

  if (state === undefined) {
    return <p className="mt-2 text-brand-muted text-xs">Loading cited brief…</p>;
  }
  if (state === null) {
    return (
      <p className="mt-2 text-brand-muted text-xs">
        No accepted MICE website brief is linked to this exact Query pair.
      </p>
    );
  }

  const rows = briefRows(state.source.brief);
  const { draft } = state;

  return (
    <div className="mt-3 space-y-3 text-xs">
      <div className="rounded-lg border border-brand-border/70 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-heading font-semibold text-brand-dark">
            Citius Holidays · MICE Proposal Doc draft
          </div>
          <span className="rounded-full bg-brand-light px-2 py-1 font-medium text-citius-blue">
            {draft ? statusLabel(draft.status) : "Not generated"}
          </span>
        </div>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-brand-muted">Client</dt>
            <dd className="font-medium text-brand-dark">
              {draft?.clientName ?? state.source.clientName}
            </dd>
          </div>
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-brand-muted">{label}</dt>
              <dd className="font-medium text-brand-dark">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="rounded-lg bg-brand-light/60 p-2 text-brand-muted">
        Source {state.source.receiptReference} · accepted {formatTimestamp(state.source.acceptedAt)}
        {" · "}brief revision {state.source.briefRevision} · digest{" "}
        <span className="font-mono">{state.source.briefDigest.slice(0, 12)}…</span>
        {" · "}Proposal revision {proposalRevision}
      </p>

      <div className="flex flex-wrap gap-2">
        {!draft && canManage ? (
          <button
            className="portal-small-btn"
            disabled={pending}
            onClick={() => run(createDraft, "Revision-bound draft generated.")}
            type="button"
          >
            Generate cited draft
          </button>
        ) : null}
        {draft?.status === "draft" && canManage ? (
          <button
            className="portal-small-btn"
            disabled={pending}
            onClick={() => run(markReviewed, "Draft marked human reviewed.")}
            type="button"
          >
            Mark human reviewed
          </button>
        ) : null}
        {draft?.status === "reviewed" && canApproveSend ? (
          <button
            className="portal-small-btn"
            disabled={pending}
            onClick={() =>
              run(approveForManualSend, "Draft approved for a separate manual send step.")
            }
            type="button"
          >
            Approve for manual send
          </button>
        ) : null}
      </div>

      <p className="text-brand-muted">
        This record does not quote, attach a PDF, hand off the Proposal, or contact the client.
      </p>
      <p aria-live="polite" className="text-brand-muted" role="status">
        {pending ? "Saving…" : null}
        {pending ? null : <span>{announcement}</span>}
      </p>
    </div>
  );
}

export function MiceProposalDocDraft(props: MiceProposalDocDraftProps) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="rounded-lg border border-brand-border/70 bg-white/70 px-3 py-2"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer font-medium text-citius-blue text-xs">
        MICE Proposal Doc draft
      </summary>
      {open ? <MiceProposalDocDraftContent {...props} /> : null}
    </details>
  );
}
