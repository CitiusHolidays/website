"use client";

import { api } from "@convex/_generated/api";
import { useAction, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ExternalLink, RefreshCw, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDate } from "@/components/portal/PortalModalForm";
import { Button } from "@/components/ui/application-button";
import {
  formatRecoveryAge,
  RECOVERY_SOURCE_CONFIGS,
  type RecoverySource,
  recoverySourcesForAccess,
} from "@/lib/portal/recoveryCenterPresentation";
import { useTrackedPaginatedQuery as usePaginatedQuery } from "@/lib/portal/trackedConvexSubscriptions";
import { EmptyState } from "../portalAdminHelpers";
import type { PortalAccessSlice } from "../portalViewTypes";
import { Badge } from "../portalWorkspaceListUi";

const PAGE_SIZE = 12;

const retryPassportCleanupRef = api.crm.passportCleanupCommands.retryPassportCleanup;

type RecoveryItem = FunctionReturnType<typeof api.crm.recoveryCenter.listItems>["page"][number];
type PassportCleanupRetry = Extract<
  NonNullable<RecoveryItem["retry"]>,
  { expectedUpdatedAt: number }
>;
const STATUS_LABELS = {
  exhausted: "Exhausted",
  failed: "Failed",
  partial: "Partial",
  retryable: "Retryable",
  stale: "Stale",
} satisfies Record<RecoveryItem["status"], string>;

const STATUS_TONES = {
  exhausted: "red",
  failed: "red",
  partial: "amber",
  retryable: "blue",
  stale: "amber",
} satisfies Record<RecoveryItem["status"], string>;

const READINESS_COPY = {
  manual_review: "Manual review required",
  retry_available: "Replay-safe retry available",
  retry_exhausted: "Retry limit reached",
  retrying: "System retry in progress",
  source_required: "Original source required",
} satisfies Record<RecoveryItem["readiness"], string>;

function passportCleanupTarget(retry: PassportCleanupRetry) {
  return retry.kind === "passport_upload_cleanup"
    ? { kind: retry.kind, ticketId: retry.ticketId }
    : { cleanupRecordId: retry.cleanupRecordId, kind: retry.kind };
}

function replaySafePassportCommand(
  commandIds: Map<string, string>,
  itemId: string,
  expectedUpdatedAt: number
) {
  const commandKey = `${itemId}:${expectedUpdatedAt}`;
  for (const existingKey of commandIds.keys()) {
    if (existingKey.startsWith(`${itemId}:`) && existingKey !== commandKey) {
      commandIds.delete(existingKey);
    }
  }
  const existing = commandIds.get(commandKey);
  if (existing) {
    return { commandId: existing, commandKey };
  }
  const commandId = crypto.randomUUID();
  commandIds.set(commandKey, commandId);
  if (commandIds.size > 20) {
    const oldestKey = commandIds.keys().next().value;
    if (oldestKey) {
      commandIds.delete(oldestKey);
    }
  }
  return { commandId, commandKey };
}

function RecoveryItemCard({
  item,
  retryingId,
  onRetry,
}: {
  item: RecoveryItem;
  onRetry: (item: RecoveryItem) => void;
  retryingId: string | null;
}) {
  const isRetrying = retryingId === item.id;
  return (
    <article className="rounded-xl border border-brand-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge label={STATUS_LABELS[item.status]} tone={STATUS_TONES[item.status]} />
            <span className="font-medium text-brand-muted text-xs">
              {READINESS_COPY[item.readiness]}
            </span>
          </div>
          <p className="mt-3 font-medium text-brand-dark text-sm">{item.summary}</p>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
            <div>
              <dt className="font-semibold text-brand-muted uppercase tracking-[0.08em]">Owner</dt>
              <dd className="mt-1 text-brand-dark">{item.owner.label}</dd>
            </div>
            <div>
              <dt className="font-semibold text-brand-muted uppercase tracking-[0.08em]">Age</dt>
              <dd className="mt-1 text-brand-dark">{formatRecoveryAge(item.ageMs)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-brand-muted uppercase tracking-[0.08em]">
                Freshness
              </dt>
              <dd className="mt-1 text-brand-dark">
                {item.freshness === "recent" ? "Recently updated" : "Aged record"}
              </dd>
            </div>
          </dl>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link className="portal-small-btn bg-white" href={item.href}>
            Open owner
            <ExternalLink aria-hidden="true" size={14} />
          </Link>
          {item.retry ? (
            <Button
              aria-busy={isRetrying || undefined}
              className="portal-primary-btn"
              disabled={isRetrying}
              onClick={() => onRetry(item)}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={14} />
              {isRetrying ? "Requesting…" : "Retry safely"}
            </Button>
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-brand-muted text-xs">Updated {formatDate(item.updatedAt)}</p>
    </article>
  );
}

function RecoveryResults({
  canLoadMore,
  items,
  loading,
  onRetry,
  retryingId,
}: {
  canLoadMore: boolean;
  items: RecoveryItem[];
  loading: boolean;
  onRetry: (item: RecoveryItem) => void;
  retryingId: string | null;
}) {
  if (loading) {
    return (
      <div
        className="rounded-xl border border-brand-border bg-white p-8 text-center text-brand-muted text-sm"
        role="status"
      >
        Loading authorized recovery records…
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        label={
          canLoadMore
            ? "No actionable records are visible in the loaded page. More authorized records may be available."
            : "No actionable records are visible. This is not a system-health claim."
        }
      />
    );
  }
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <RecoveryItemCard item={item} key={item.id} onRetry={onRetry} retryingId={retryingId} />
      ))}
    </div>
  );
}

export function RecoveryCenterView({ access = {} }: { access?: PortalAccessSlice }) {
  const sources = useMemo(() => recoverySourcesForAccess(access), [access]);
  const [source, setSource] = useState<RecoverySource>(sources[0]?.id ?? "passenger_import");
  const [referenceNow, setReferenceNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const commandIdsByRetryRevision = useRef(new Map<string, string>());
  const startPassengerExport = useAction(api.crm.importActions.startPassengerExport);
  const retryPassportCleanup = useMutation(retryPassportCleanupRef);
  const selectedSource = sources.some((candidate) => candidate.id === source)
    ? source
    : (sources[0]?.id ?? "passenger_import");

  useEffect(() => {
    if (source !== selectedSource) {
      setSource(selectedSource);
    }
  }, [selectedSource, source]);

  const page = usePaginatedQuery(
    api.crm.recoveryCenter.listItems,
    { referenceNow, source: selectedSource },
    { initialNumItems: PAGE_SIZE }
  );
  const activeSource =
    sources.find((candidate) => candidate.id === selectedSource) ?? RECOVERY_SOURCE_CONFIGS[0];
  const loading = page.status === "LoadingFirstPage";
  const loadingMore = page.status === "LoadingMore";
  const canLoadMore = page.status === "CanLoadMore";

  const selectSource = (nextSource: RecoverySource) => {
    setSource(nextSource);
    setAnnouncement("");
  };
  const refresh = () => {
    commandIdsByRetryRevision.current.clear();
    setReferenceNow(Date.now());
    setAnnouncement("Recovery records refreshed from a new reference time.");
  };
  const retry = async (item: RecoveryItem) => {
    if (!item.retry || retryingId) {
      return;
    }
    setRetryingId(item.id);
    setAnnouncement("");
    try {
      if (item.retry.kind === "passenger_export") {
        await startPassengerExport({
          commandId: item.retry.commandId,
          exportKind: item.retry.exportKind,
          jobCardId: item.retry.jobCardId,
        });
      } else {
        const command = replaySafePassportCommand(
          commandIdsByRetryRevision.current,
          item.id,
          item.retry.expectedUpdatedAt
        );
        await retryPassportCleanup({
          cleanup: passportCleanupTarget(item.retry),
          commandId: command.commandId,
          expectedUpdatedAt: item.retry.expectedUpdatedAt,
        });
        commandIdsByRetryRevision.current.delete(command.commandKey);
      }
      setReferenceNow(Date.now());
      setAnnouncement("Replay-safe retry accepted. Progress will update on refresh.");
    } catch {
      setAnnouncement(
        "Retry was not accepted. Refresh this record and review its owning workflow."
      );
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <section aria-labelledby="recovery-center-title" className="space-y-5">
      <div className="rounded-xl border border-brand-border bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2
              className="font-heading font-semibold text-citius-blue text-xl md:text-2xl"
              id="recovery-center-title"
            >
              Recovery Center
            </h2>
            <p className="mt-1 max-w-3xl text-brand-muted text-sm">
              Actionable background work only. Missing rows do not prove that every system is
              healthy, and retry is available only for reviewed replay-safe commands.
            </p>
          </div>
          <Button className="portal-small-btn bg-white" onClick={refresh} type="button">
            <RefreshCw aria-hidden="true" size={14} />
            Refresh
          </Button>
        </div>
        <p className="mt-3 text-brand-muted text-xs">Reference time {formatDate(referenceNow)}</p>
      </div>

      <div aria-label="Recovery work type" className="flex flex-wrap gap-2" role="tablist">
        {sources.map((candidate) => (
          <Button
            aria-controls="recovery-work-panel"
            aria-selected={candidate.id === selectedSource}
            className={
              candidate.id === selectedSource
                ? "portal-small-btn border-citius-blue bg-citius-blue text-white"
                : "portal-small-btn bg-white"
            }
            key={candidate.id}
            onClick={() => selectSource(candidate.id)}
            role="tab"
            type="button"
          >
            {candidate.label}
          </Button>
        ))}
      </div>

      <div
        aria-busy={loading || loadingMore || undefined}
        aria-labelledby="recovery-work-title"
        id="recovery-work-panel"
        role="tabpanel"
      >
        {selectedSource === "workflow_nudge" ? (
          <span aria-hidden="true" id="workflow-automation" />
        ) : null}
        <div className="mb-3">
          <h3
            className="font-heading font-semibold text-brand-dark text-lg"
            id="recovery-work-title"
          >
            {activeSource.label}
          </h3>
          <p className="mt-1 text-brand-muted text-sm">{activeSource.description}</p>
        </div>

        <RecoveryResults
          canLoadMore={canLoadMore}
          items={page.results}
          loading={loading}
          onRetry={retry}
          retryingId={retryingId}
        />

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <span className="text-brand-muted text-xs">
            {page.results.length} actionable records loaded
            {canLoadMore ? "; more source records are available." : "."}
          </span>
          {canLoadMore || loadingMore ? (
            <Button
              aria-busy={loadingMore || undefined}
              className="portal-small-btn bg-white"
              disabled={loadingMore}
              onClick={() => page.loadMore(PAGE_SIZE)}
              type="button"
            >
              {loadingMore ? "Loading more…" : "Load more records"}
            </Button>
          ) : null}
        </div>
      </div>

      <p aria-atomic="true" aria-live="polite" className="sr-only" role="status">
        {announcement}
      </p>
    </section>
  );
}
