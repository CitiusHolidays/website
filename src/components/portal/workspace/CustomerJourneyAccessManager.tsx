"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Ban, RotateCcw, ShieldCheck, X } from "lucide-react";
import { useRef, useState } from "react";
import { PortalSearchField } from "@/components/portal/PortalSearchField";
import { usePortalToast } from "@/components/portal/PortalToast";
import { Button } from "@/components/ui/application-button";
import { ControlledDialog, ControlledDialogTitle } from "@/components/ui/application-dialog";
import { Select } from "@/components/ui/application-select";
import { formatDisplayDate } from "@/lib/formatDate";
import {
  useTrackedPaginatedQuery as usePaginatedQuery,
  useTrackedQuery as useQuery,
} from "@/lib/portal/trackedConvexSubscriptions";
import { PORTAL_Z } from "@/lib/portal/zIndex";
import { formatConvexError } from "./portalWorkspaceListHelpers";

type AccessPage = FunctionReturnType<typeof api.customerConfirmedTrips.listConfirmedTripAccess>;
type AccessRecord = AccessPage["page"][number];
type AccessContext = FunctionReturnType<
  typeof api.customerConfirmedTrips.getConfirmedTripAccessContext
>;

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});
function formatTimestamp(value: number) {
  return DATE_TIME_FORMAT.format(value);
}

function accessSourceLabel(source: AccessRecord["source"]) {
  return source === "identity_migration" ? "Identity migration" : "Staff grant";
}

function AccessRecordRow({
  busy,
  onChange,
  reasonReady,
  record,
}: {
  busy: boolean;
  onChange: (record: AccessRecord) => void;
  reasonReady: boolean;
  record: AccessRecord;
}) {
  const changeAccess = () => onChange(record);
  const active = record.status === "active";
  const restoreNeedsBinding = !active && record.role === "traveller";
  let actionLabel = active ? "Revoke access" : "Restore access";
  if (restoreNeedsBinding) {
    actionLabel = "Verified binding required";
  }

  return (
    <article className="rounded-xl border border-brand-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-brand-dark">{record.accountHolder.name}</div>
          <div className="break-all text-brand-muted text-xs">
            {record.accountHolder.email || "Email unavailable"}
          </div>
          <div className="mt-1 text-brand-muted text-xs">
            {record.role === "organizer" ? "Organizer" : "Traveller"} ·{" "}
            {accessSourceLabel(record.source)}
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 font-semibold text-xs ${
            active ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
          }`}
        >
          {active ? "Active" : "Revoked"}
        </span>
      </div>
      <dl className="mt-3 grid gap-2 border-brand-border/70 border-t pt-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-brand-muted">Granted</dt>
          <dd className="font-medium text-brand-dark">
            {formatTimestamp(record.grantedAt)}
            {record.grantedBy ? ` by ${record.grantedBy}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-brand-muted">Latest access change</dt>
          <dd className="font-medium text-brand-dark">
            {record.lastChange
              ? `${record.lastChange.action} ${formatTimestamp(record.lastChange.at)} by ${
                  record.lastChange.actorName
                }`
              : "No recorded change"}
          </dd>
        </div>
        {record.lastChange?.reason ? (
          <div className="sm:col-span-2">
            <dt className="text-brand-muted">Reason</dt>
            <dd className="whitespace-pre-wrap text-brand-dark">{record.lastChange.reason}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-3 flex justify-end">
        <Button
          className={active ? "portal-danger-btn" : "portal-outline-btn"}
          disabled={!reasonReady || busy || restoreNeedsBinding}
          onClick={changeAccess}
          type="button"
        >
          {active ? <Ban aria-hidden size={14} /> : <RotateCcw aria-hidden size={14} />}
          {actionLabel}
        </Button>
      </div>
    </article>
  );
}

function JourneyPreview({ context }: { context: AccessContext | undefined }) {
  if (!context) {
    return (
      <div className="rounded-xl border border-brand-border p-4 text-brand-muted text-sm">
        Loading confirmed journey…
      </div>
    );
  }
  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
      <div className="font-heading font-semibold text-citius-blue">
        {context.queryCode} · {context.destination}
      </div>
      <div className="mt-1 text-brand-muted text-sm">
        {formatDisplayDate(context.travelStartDate)}
        {context.travelEndDate ? ` – ${formatDisplayDate(context.travelEndDate)}` : ""}
      </div>
      <p className="mt-2 text-blue-900 text-xs">
        Account access is owned by committed server entitlements. Revoked access remains denied
        until a Staff member restores it with a reason.
      </p>
    </section>
  );
}

interface GrantAccessSectionProps {
  accessLoaded: boolean;
  accountHolderOptions: { label: string; value: string }[];
  accountHolderProfileId: string;
  accountHolderStatus: "CanLoadMore" | "Exhausted" | "LoadingFirstPage" | "LoadingMore";
  busy: boolean;
  grantBusy: boolean;
  onAccountHolderChange: (value: string) => void;
  onGrant: () => void;
  onLoadMore: () => void;
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  search: string;
}

function GrantAccessSection({
  accessLoaded,
  accountHolderOptions,
  accountHolderProfileId,
  accountHolderStatus,
  busy,
  grantBusy,
  onAccountHolderChange,
  onGrant,
  onLoadMore,
  onSearchChange,
  search,
}: GrantAccessSectionProps) {
  return (
    <section aria-labelledby="customer-access-grant-heading" className="space-y-3">
      <div>
        <h3
          className="font-heading font-semibold text-brand-dark"
          id="customer-access-grant-heading"
        >
          Grant access
        </h3>
        <p className="text-brand-muted text-xs">
          Search canonical Account holders. Matching email addresses remain separate profiles.
          Traveller grants stay unavailable until a verified Traveller-to-Account binding exists.
        </p>
      </div>
      <PortalSearchField
        label="Search Account holders"
        onChange={onSearchChange}
        placeholder="Search by name or email"
        value={search}
      />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
        <Select
          aria-label="Account holder"
          className="portal-toolbar-control h-11 w-full rounded-xl border border-brand-border bg-white px-3 text-sm"
          disabled={accountHolderStatus === "LoadingFirstPage"}
          onValueChange={onAccountHolderChange}
          options={accountHolderOptions}
          value={accountHolderProfileId}
        />
        <div className="portal-toolbar-control flex h-11 items-center rounded-xl border border-brand-border bg-brand-light/40 px-3 font-medium text-brand-dark text-sm">
          <span className="sr-only">Journey access role: </span>
          Organizer
        </div>
        <Button
          className="portal-primary-btn min-h-11"
          disabled={!(accessLoaded && accountHolderProfileId) || busy}
          loading={grantBusy}
          onClick={onGrant}
          type="button"
        >
          Grant access
        </Button>
      </div>
      {accountHolderStatus === "CanLoadMore" ? (
        <Button className="portal-small-btn" onClick={onLoadMore} type="button">
          Load more Account holders
        </Button>
      ) : null}
      {accountHolderStatus === "LoadingMore" ? (
        <div className="text-brand-muted text-xs">Loading more Account holders…</div>
      ) : null}
    </section>
  );
}

function AccessRecordsSection({
  busy,
  loadMore,
  onChangeAccess,
  onReasonChange,
  reason,
  reasonReady,
  records,
  status,
}: {
  busy: boolean;
  loadMore: () => void;
  onChangeAccess: (record: AccessRecord) => void;
  onReasonChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  reason: string;
  reasonReady: boolean;
  records: AccessRecord[];
  status: "CanLoadMore" | "Exhausted" | "LoadingFirstPage" | "LoadingMore";
}) {
  const hasRecords = records.length > 0;
  return (
    <section aria-labelledby="customer-access-records-heading" className="space-y-3">
      <div>
        <h3
          className="font-heading font-semibold text-brand-dark"
          id="customer-access-records-heading"
        >
          Current and revoked access
        </h3>
        <p className="text-brand-muted text-xs">
          A reason of 3–240 characters is required for every revoke or restore.
        </p>
      </div>
      <label className="block" htmlFor="customer-journey-access-reason">
        <span className="font-medium text-brand-dark text-xs">Reason</span>
        <textarea
          className="mt-1 min-h-20 w-full resize-y rounded-xl border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10"
          id="customer-journey-access-reason"
          maxLength={240}
          onChange={onReasonChange}
          placeholder="Explain why access should be revoked or restored"
          value={reason}
        />
      </label>
      {hasRecords ? (
        <div className="space-y-3">
          {records.map((record) => (
            <AccessRecordRow
              busy={busy}
              key={record.id}
              onChange={onChangeAccess}
              reasonReady={reasonReady}
              record={record}
            />
          ))}
        </div>
      ) : null}
      {status === "Exhausted" && !hasRecords ? (
        <div className="rounded-xl border border-brand-border border-dashed p-4 text-brand-muted text-sm">
          No explicit Customer Journey access has been granted for this Query.
        </div>
      ) : null}
      {status === "CanLoadMore" ? (
        <Button className="portal-small-btn" onClick={loadMore} type="button">
          Load more access records
        </Button>
      ) : null}
      {status === "LoadingMore" ? (
        <div className="text-brand-muted text-xs">Loading more access records…</div>
      ) : null}
    </section>
  );
}

interface CustomerJourneyAccessManagerProps {
  onClose: () => void;
  open: boolean;
  queryId: Id<"queries"> | null;
}

function CustomerJourneyAccessManagerInstance({
  onClose,
  open,
  queryId,
}: CustomerJourneyAccessManagerProps) {
  const typedQueryId = queryId;
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const toast = usePortalToast();
  const context = useQuery(
    api.customerConfirmedTrips.getConfirmedTripAccessContext,
    open && typedQueryId ? { queryId: typedQueryId } : "skip"
  );
  const access = usePaginatedQuery(
    api.customerConfirmedTrips.listConfirmedTripAccess,
    open && typedQueryId ? { queryId: typedQueryId } : "skip",
    { initialNumItems: 20 }
  );
  const grantAccess = useMutation(api.customerConfirmedTrips.grantConfirmedTripEntitlement);
  const revokeAccess = useMutation(api.customerConfirmedTrips.revokeConfirmedTripEntitlement);
  const restoreAccess = useMutation(api.customerConfirmedTrips.restoreConfirmedTripEntitlement);
  const [search, setSearch] = useState("");
  const [accountHolderProfileId, setAccountHolderProfileId] = useState<Id<"userProfiles"> | "">("");
  const [reason, setReason] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const commandIdsBySubmission = useRef(new Map<string, string>());
  const accountHolders = usePaginatedQuery(
    api.customerConfirmedTrips.listAccountHolderOptions,
    open && typedQueryId ? { queryId: typedQueryId, search: search.trim() || undefined } : "skip",
    { initialNumItems: 25 }
  );
  const accountHolderOptions = [
    { label: "Select an Account holder", value: "" },
    ...accountHolders.results.map((holder) => ({
      label: `${holder.name} · ${holder.email} · ${String(holder.id).slice(-6)}`,
      value: String(holder.id),
    })),
  ];
  const trimmedReason = reason.trim();
  const reasonReady = trimmedReason.length >= 3 && trimmedReason.length <= 240;
  const busy = Boolean(busyKey);

  const close = () => {
    if (!busy) {
      onClose();
    }
  };
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      close();
    }
  };
  const updateSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setAccountHolderProfileId("");
  };
  const updateReason = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReason(event.target.value);
  };
  const updateAccountHolderProfileId = (value: string) => {
    const selected = accountHolders.results.find((holder) => String(holder.id) === value);
    setAccountHolderProfileId(selected?.id ?? "");
  };
  const loadMoreAccountHolders = () => accountHolders.loadMore(25);
  const replaySafeCommandId = (signature: string) => {
    const existing = commandIdsBySubmission.current.get(signature);
    if (existing) {
      return existing;
    }
    const commandId = crypto.randomUUID();
    commandIdsBySubmission.current.set(signature, commandId);
    if (commandIdsBySubmission.current.size > 20) {
      const oldest = commandIdsBySubmission.current.keys().next().value;
      if (oldest) {
        commandIdsBySubmission.current.delete(oldest);
      }
    }
    return commandId;
  };
  const grant = async () => {
    if (!(typedQueryId && accountHolderProfileId) || busy) {
      return;
    }
    setBusyKey("grant");
    setError("");
    const signature = `customer_journey.grant.v1:${typedQueryId}:${accountHolderProfileId}:organizer`;
    try {
      await grantAccess({
        accountHolderProfileId,
        commandId: replaySafeCommandId(signature),
        queryId: typedQueryId,
        role: "organizer",
      });
      commandIdsBySubmission.current.delete(signature);
      setAccountHolderProfileId("");
      toast.success("Customer Journey access granted.");
    } catch (cause) {
      const message = formatConvexError(
        cause,
        "Unable to grant access. Revoked access must be deliberately restored below."
      );
      setError(message);
      toast.error(message);
    } finally {
      setBusyKey("");
    }
  };
  const changeAccess = async (record: AccessRecord) => {
    if (!(typedQueryId && reasonReady) || busy) {
      return;
    }
    setBusyKey(String(record.id));
    setError("");
    const action = record.status === "active" ? "revoke" : "restore";
    const signature = `customer_journey.${action}.v1:${typedQueryId}:${record.id}:${trimmedReason}`;
    try {
      const args = {
        commandId: replaySafeCommandId(signature),
        entitlementId: record.id,
        queryId: typedQueryId,
        reason: trimmedReason,
      };
      if (record.status === "active") {
        await revokeAccess(args);
        toast.success("Customer Journey access revoked.");
      } else {
        await restoreAccess(args);
        toast.success("Customer Journey access restored.");
      }
      commandIdsBySubmission.current.delete(signature);
      setReason("");
    } catch (cause) {
      const message = formatConvexError(cause, "Unable to change Customer Journey access.");
      setError(message);
      toast.error(message);
    } finally {
      setBusyKey("");
    }
  };

  return (
    <ControlledDialog
      backdropClassName="absolute inset-0 bg-slate-950/65"
      closeDisabled={busy}
      initialFocus={closeButtonRef}
      onOpenChange={handleOpenChange}
      open={open}
      popupClassName="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-brand-border bg-white shadow-2xl max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none"
      triggerless
      viewportClassName={`fixed inset-0 ${PORTAL_Z.entityModal} grid place-items-center p-4 max-sm:p-0`}
    >
      {open ? (
        <>
          <div className="flex shrink-0 items-start justify-between gap-4 border-brand-border border-b px-5 py-4 max-sm:px-4">
            <div>
              <ControlledDialogTitle className="flex items-center gap-2 font-heading font-semibold text-citius-blue text-xl">
                <ShieldCheck aria-hidden size={20} /> Customer Journey access
              </ControlledDialogTitle>
              <p className="mt-1 text-brand-muted text-sm">
                Preview, grant, inspect, revoke, or deliberately restore access for this confirmed
                Query.
              </p>
            </div>
            <Button
              aria-label="Close Customer Journey access"
              className="portal-small-btn"
              disabled={busy}
              onClick={close}
              ref={closeButtonRef}
              type="button"
            >
              <X aria-hidden size={15} /> Close
            </Button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 max-sm:px-4">
            <JourneyPreview context={context} />

            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 text-sm">
                {error}
              </div>
            ) : null}

            <GrantAccessSection
              accessLoaded={Boolean(context)}
              accountHolderOptions={accountHolderOptions}
              accountHolderProfileId={accountHolderProfileId}
              accountHolderStatus={accountHolders.status}
              busy={busy}
              grantBusy={busyKey === "grant"}
              onAccountHolderChange={updateAccountHolderProfileId}
              onGrant={grant}
              onLoadMore={loadMoreAccountHolders}
              onSearchChange={updateSearch}
              search={search}
            />

            <AccessRecordsSection
              busy={busy}
              loadMore={() => access.loadMore(20)}
              onChangeAccess={changeAccess}
              onReasonChange={updateReason}
              reason={reason}
              reasonReady={reasonReady}
              records={access.results}
              status={access.status}
            />
          </div>
        </>
      ) : null}
    </ControlledDialog>
  );
}

export function CustomerJourneyAccessManager(props: CustomerJourneyAccessManagerProps) {
  return (
    <CustomerJourneyAccessManagerInstance
      {...props}
      key={props.queryId ?? "closed-customer-journey-access"}
    />
  );
}
