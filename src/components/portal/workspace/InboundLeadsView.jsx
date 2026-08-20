"use client";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Select } from "@/components/ui/application-select";
import {
  useTrackedPaginatedQuery as usePaginatedQuery,
  useTrackedQuery as useQuery,
} from "@/lib/portal/trackedConvexSubscriptions";
import { isRuntimeObject, isRuntimeString } from "@/lib/runtimeValues";
import { describeSacredBharatIntentContext } from "@/lib/sacredBharat/inboundIntent";

const STATUS_OPTIONS = [
  ["pending", "Pending"],
  ["converted", "Converted"],
  ["dismissed", "Dismissed"],
];
const SOURCE_OPTIONS = [
  ["", "All sources"],
  ["Website", "Website"],
  ["Citius Concierge", "Citius Concierge"],
  ["Sacred Bharat", "Sacred Bharat"],
];
const DISMISSAL_OPTIONS = [
  ["not_qualified", "Not qualified"],
  ["duplicate_enquiry", "Duplicate enquiry"],
  ["unable_to_reach", "Unable to reach"],
];
const QUERY_TYPES = ["FIT", "Family Group", "MICE", "MICE Bidding", "B2B", "Spiritual"];

function inboundErrorMessage(error, fallback) {
  if (!isRuntimeObject(error)) {
    return fallback;
  }
  if (isRuntimeString(error.data) && error.data) {
    return error.data;
  }
  return isRuntimeString(error.message) && error.message ? error.message : fallback;
}
const TRAVEL_TYPES = ["Domestic Travel", "International Travel"];
const MAX_QUERY_NOTES_WORDS = 30;
const WORD_SEPARATOR = /\s+/;
const CREATED_AT_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
  year: "numeric",
});

function countWords(value) {
  const normalized = String(value || "").trim();
  return normalized ? normalized.split(WORD_SEPARATOR).length : 0;
}

function formatCreatedAt(value) {
  if (!value) {
    return "—";
  }
  return CREATED_AT_FORMATTER.format(new Date(value));
}

function formFromIntent(intent) {
  const sourceNotes = intent?.notes || "";
  return {
    budgetAmount: "",
    clientName: intent?.clientName || "",
    contactMobile: intent?.contactMobile || "",
    contactPerson: "",
    destination: intent?.destination || "",
    intentId: intent?._id || null,
    notes: countWords(sourceNotes) <= MAX_QUERY_NOTES_WORDS ? sourceNotes : "",
    paxCount: String(intent?.paxCount || 1),
    queryType: "FIT",
    salesOwnerName: "",
    salesOwnerStaffId: "",
    travelEndDate: "",
    travelStartDate: intent?.travelStartDate || "",
    travelType: "International Travel",
  };
}

async function runInboundConversion({ args, convert, onSuccess }) {
  try {
    const result = await convert(args);
    onSuccess(result);
    return "";
  } catch (conversionError) {
    return inboundErrorMessage(conversionError, "Unable to convert this lead.");
  }
}

function fieldLabel(id, label, children) {
  return (
    <div className="grid gap-1 text-brand-dark text-sm">
      <label className="font-medium" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

function renderEither(condition, whenTrue, whenFalse) {
  return condition ? whenTrue : whenFalse;
}

function renderWhen(condition, content) {
  return condition ? content : null;
}

function renderSacredContextDescription(description) {
  if (!description) {
    return null;
  }
  return (
    <div>
      <dt className="text-brand-muted text-xs">Sacred planning context</dt>
      <dd className="text-brand-dark">{description.label}</dd>
    </div>
  );
}

function InboundLeadRow({ row, selected, onSelect }) {
  const handleSelect = useCallback(() => onSelect(row._id), [onSelect, row._id]);
  return (
    <tr className={selected ? "bg-citius-blue/5" : ""}>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-brand-dark">{row.clientName}</span>
          {row.isSynthetic ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-[10px] text-violet-900 uppercase tracking-wide">
              Test
            </span>
          ) : null}
        </div>
        <div className="mt-1 text-brand-muted text-xs">
          {row.contactEmail || row.contactMobile || "No contact supplied"}
        </div>
      </td>
      <td className="px-4 py-3 align-top text-brand-muted">
        <div>{row.destination || "Destination TBD"}</div>
        <div className="mt-1 text-xs">{row.source}</div>
      </td>
      <td className="px-4 py-3 align-top text-brand-muted">{formatCreatedAt(row.createdAt)}</td>
      <td className="px-4 py-3 align-top">
        <button className="portal-small-btn" onClick={handleSelect} type="button">
          Review
        </button>
      </td>
    </tr>
  );
}

function useInboundLeadsController({ allowed, canFetch }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkedId = searchParams.get("open") === "inboundIntent" ? searchParams.get("id") : null;
  const [status, setStatus] = useState("pending");
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(deepLinkedId);
  const [form, setForm] = useState(() => formFromIntent(null));
  const [dismissalReason, setDismissalReason] = useState("not_qualified");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const shouldFetch = Boolean(allowed && canFetch);
  const page = usePaginatedQuery(
    api.crm.inboundQueryIntents.list,
    shouldFetch
      ? {
          search: search.trim() || undefined,
          source: source || undefined,
          status,
        }
      : "skip",
    { initialNumItems: 50 }
  );
  const selected = useQuery(
    api.crm.inboundQueryIntents.getForSales,
    shouldFetch && selectedId ? { intentId: selectedId } : "skip"
  );
  const convert = useMutation(api.crm.inboundQueryIntents.convertToQuery);
  const dismiss = useMutation(api.crm.inboundQueryIntents.dismiss);

  useEffect(() => {
    if (deepLinkedId) {
      setSelectedId(deepLinkedId);
    }
  }, [deepLinkedId]);

  useEffect(() => {
    if (selected && selected._id !== form.intentId) {
      setForm(formFromIntent(selected));
      setDismissalReason("not_qualified");
      setError("");
      setMessage("");
    }
  }, [form.intentId, selected]);

  const rows = page.results || [];
  const notesWordCount = countWords(form.notes);
  const notesOverLimit = notesWordCount > MAX_QUERY_NOTES_WORDS;
  const sourceNotesOverLimit = countWords(selected?.notes) > MAX_QUERY_NOTES_WORDS;
  const sacredContextDescription = describeSacredBharatIntentContext(selected?.sacredBharatContext);
  const setField = useCallback(
    (field, value) => setForm((current) => ({ ...current, [field]: value })),
    []
  );
  const handleFieldChange = useCallback(
    (event) => setField(event.currentTarget.name, event.currentTarget.value),
    [setField]
  );
  const handleSearchChange = useCallback((event) => setSearch(event.currentTarget.value), []);
  const handleQueryTypeChange = useCallback((value) => setField("queryType", value), [setField]);
  const handleTravelTypeChange = useCallback((value) => setField("travelType", value), [setField]);
  const loadMore = useCallback(() => page.loadMore(50), [page.loadMore]);

  const handleConvert = useCallback(
    async (event) => {
      event.preventDefault();
      if (!selectedId || selected?.status !== "pending") {
        return;
      }
      if (notesOverLimit) {
        setError(`Query Notes must be ${MAX_QUERY_NOTES_WORDS} words or fewer.`);
        return;
      }
      setSaving(true);
      setError("");
      setMessage("");
      try {
        const conversionError = await runInboundConversion({
          args: {
            ...form,
            budgetAmount: form.budgetAmount ? Number(form.budgetAmount) : undefined,
            intentId: selectedId,
            paxCount: Number(form.paxCount),
          },
          convert,
          onSuccess: (result) => {
            setMessage(`${result.queryCode} created and linked to this inbound lead.`);
            router.replace("/portal/inbound-leads");
          },
        });
        if (conversionError) {
          setError(conversionError);
        }
      } finally {
        setSaving(false);
      }
    },
    [convert, form, notesOverLimit, router, selected?.status, selectedId]
  );

  const handleDismiss = useCallback(async () => {
    if (!selectedId || selected?.status !== "pending") {
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await dismiss({ dismissalReason, intentId: selectedId });
      setMessage("Lead dismissed. Its consent and source record remain available.");
      router.replace("/portal/inbound-leads");
    } catch (dismissError) {
      setError(inboundErrorMessage(dismissError, "Unable to dismiss this lead."));
    } finally {
      setSaving(false);
    }
  }, [dismiss, dismissalReason, router, selected?.status, selectedId]);

  return {
    dismissalReason,
    error,
    form,
    handleConvert,
    handleDismiss,
    handleFieldChange,
    handleQueryTypeChange,
    handleSearchChange,
    handleTravelTypeChange,
    loadMore,
    message,
    notesOverLimit,
    notesWordCount,
    page,
    rows,
    sacredContextDescription,
    saving,
    search,
    selected,
    selectedId,
    setDismissalReason,
    setSelectedId,
    setSource,
    setStatus,
    shouldFetch,
    source,
    sourceNotesOverLimit,
    status,
  };
}

function recordedOutcomeCopy(selected) {
  const dismissalLabel = DISMISSAL_OPTIONS.find(
    ([value]) => value === selected.dismissalReason
  )?.[1];
  const reason = selected.dismissalReason
    ? ` Reason: ${dismissalLabel || selected.dismissalReason}.`
    : "";
  const date = selected.triagedAt
    ? ` Outcome recorded: ${formatCreatedAt(selected.triagedAt)}.`
    : " Outcome date unavailable for this legacy record.";
  return `This lead is already ${selected.status}. It cannot be triaged again.${reason}${date}`;
}

export function InboundLeadsView({ allowed, canFetch }) {
  const {
    dismissalReason,
    error,
    form,
    handleConvert,
    handleDismiss,
    handleFieldChange,
    handleQueryTypeChange,
    handleSearchChange,
    handleTravelTypeChange,
    loadMore,
    message,
    notesOverLimit,
    notesWordCount,
    page,
    rows,
    sacredContextDescription,
    saving,
    search,
    selected,
    selectedId,
    setDismissalReason,
    setSelectedId,
    setSource,
    setStatus,
    shouldFetch,
    source,
    sourceNotesOverLimit,
    status,
  } = useInboundLeadsController({ allowed, canFetch });

  if (!shouldFetch) {
    return null;
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]">
      <div className="rounded-2xl border border-brand-border bg-white shadow-sm">
        <div className="flex flex-wrap items-end gap-3 border-brand-border border-b p-4">
          <div className="grid min-w-36 gap-1 text-brand-dark text-sm">
            <label className="font-medium" htmlFor="inbound-status-filter">
              Status
            </label>
            <Select
              aria-label="Status"
              className="portal-input"
              id="inbound-status-filter"
              onValueChange={setStatus}
              options={STATUS_OPTIONS.map(([value, label]) => ({ label, value }))}
              value={status}
            />
          </div>
          <div className="grid min-w-44 gap-1 text-brand-dark text-sm">
            <label className="font-medium" htmlFor="inbound-source-filter">
              Source
            </label>
            <Select
              aria-label="Source"
              className="portal-input"
              id="inbound-source-filter"
              onValueChange={setSource}
              options={SOURCE_OPTIONS.map(([value, label]) => ({ label, value }))}
              value={source}
            />
          </div>
          <label className="grid min-w-52 flex-1 gap-1 text-brand-dark text-sm">
            <span className="font-medium">Search</span>
            <input
              className="portal-input"
              onChange={handleSearchChange}
              placeholder="Name, destination, email"
              value={search}
            />
          </label>
          <span className="pb-2 text-brand-muted text-xs">{rows.length} loaded</span>
        </div>
        {renderEither(
          rows.length === 0,
          <p className="p-8 text-brand-muted text-sm">No inbound leads match these filters.</p>,
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-brand-light/50 text-brand-muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 font-semibold">Lead</th>
                  <th className="px-4 py-3 font-semibold">Trip</th>
                  <th className="px-4 py-3 font-semibold">Received</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/70">
                {rows.map((row) => (
                  <InboundLeadRow
                    key={row._id}
                    onSelect={setSelectedId}
                    row={row}
                    selected={row._id === selectedId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {renderWhen(
          page.status === "CanLoadMore",
          <div className="border-brand-border border-t p-4">
            <button className="portal-small-btn" onClick={loadMore} type="button">
              Load more leads
            </button>
          </div>
        )}
      </div>

      <aside className="rounded-2xl border border-brand-border bg-white p-5 shadow-sm">
        {selected ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-brand-dark text-lg">{selected.clientName}</p>
                <p className="mt-1 text-brand-muted text-xs">
                  {selected.source} · received {formatCreatedAt(selected.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {selected.isSynthetic ? (
                  <span className="rounded-full bg-violet-100 px-2.5 py-1 font-semibold text-violet-900 text-xs uppercase tracking-wide">
                    Test record
                  </span>
                ) : null}
                <span className="rounded-full bg-brand-light px-2.5 py-1 font-semibold text-brand-muted text-xs capitalize">
                  {selected.status}
                </span>
              </div>
            </div>
            <dl className="mt-5 grid gap-3 border-brand-border border-b pb-5 text-sm">
              <div>
                <dt className="text-brand-muted text-xs">Email</dt>
                <dd className="text-brand-dark">{selected.contactEmail || "Not provided"}</dd>
              </div>
              <div>
                <dt className="text-brand-muted text-xs">Mobile</dt>
                <dd className="text-brand-dark">{selected.contactMobile || "Not provided"}</dd>
              </div>
              {renderSacredContextDescription(sacredContextDescription)}
              <div>
                <dt className="text-brand-muted text-xs">Notes</dt>
                <dd className="whitespace-pre-wrap text-brand-dark">{selected.notes || "—"}</dd>
              </div>
            </dl>
            {renderWhen(
              message,
              <p aria-live="polite" className="mt-4 text-emerald-700 text-sm" role="status">
                {message}
              </p>
            )}
            {renderEither(
              selected.isSynthetic,
              <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
                <p className="font-semibold">Synthetic operational test</p>
                <p className="mt-1 leading-6">
                  This row proves that the contact form reached CRM intake. It cannot be converted
                  into a Sales Query or customer data.
                </p>
              </div>,
              renderEither(
                selected.status === "pending",
                <>
                  <form className="mt-5 grid gap-3" onSubmit={handleConvert}>
                    <p className="font-semibold text-brand-dark">Convert to Sales Query</p>
                    {fieldLabel(
                      "inbound-client-name",
                      "Client name",
                      <input
                        className="portal-input"
                        id="inbound-client-name"
                        name="clientName"
                        onChange={handleFieldChange}
                        required
                        value={form.clientName}
                      />
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {fieldLabel(
                        "inbound-destination",
                        "Destination",
                        <input
                          className="portal-input"
                          id="inbound-destination"
                          name="destination"
                          onChange={handleFieldChange}
                          value={form.destination}
                        />
                      )}
                      {fieldLabel(
                        "inbound-pax-count",
                        "Pax",
                        <input
                          className="portal-input"
                          id="inbound-pax-count"
                          min="1"
                          name="paxCount"
                          onChange={handleFieldChange}
                          required
                          type="number"
                          value={form.paxCount}
                        />
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {fieldLabel(
                        "inbound-query-type",
                        "Query type",
                        <Select
                          className="portal-input"
                          id="inbound-query-type"
                          onValueChange={handleQueryTypeChange}
                          options={QUERY_TYPES.map((option) => ({ label: option, value: option }))}
                          value={form.queryType}
                        />
                      )}
                      {fieldLabel(
                        "inbound-travel-type",
                        "Travel type",
                        <Select
                          className="portal-input"
                          id="inbound-travel-type"
                          onValueChange={handleTravelTypeChange}
                          options={TRAVEL_TYPES.map((option) => ({ label: option, value: option }))}
                          value={form.travelType}
                        />
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {fieldLabel(
                        "inbound-travel-start",
                        "Travel start",
                        <input
                          className="portal-input"
                          id="inbound-travel-start"
                          name="travelStartDate"
                          onChange={handleFieldChange}
                          type="date"
                          value={form.travelStartDate}
                        />
                      )}
                      {fieldLabel(
                        "inbound-travel-end",
                        "Travel end",
                        <input
                          className="portal-input"
                          id="inbound-travel-end"
                          name="travelEndDate"
                          onChange={handleFieldChange}
                          type="date"
                          value={form.travelEndDate}
                        />
                      )}
                    </div>
                    {fieldLabel(
                      "inbound-query-notes",
                      "Notes",
                      <>
                        <textarea
                          aria-describedby={`inbound-query-notes-help${notesOverLimit ? " inbound-query-notes-error" : ""}`}
                          aria-invalid={notesOverLimit || undefined}
                          className="portal-input min-h-24"
                          id="inbound-query-notes"
                          name="notes"
                          onChange={handleFieldChange}
                          value={form.notes}
                        />
                        <span className="text-brand-muted text-xs" id="inbound-query-notes-help">
                          {sourceNotesOverLimit
                            ? "Source notes exceed the 30-word Query Notes limit and remain available on this lead. Add a concise query note here."
                            : `${notesWordCount}/${MAX_QUERY_NOTES_WORDS} words`}
                        </span>
                        {renderWhen(
                          notesOverLimit,
                          <span
                            className="text-red-700 text-xs"
                            id="inbound-query-notes-error"
                            role="alert"
                          >
                            Query Notes must be 30 words or fewer.
                          </span>
                        )}
                      </>
                    )}
                    <button
                      className="portal-primary-btn justify-center"
                      disabled={saving}
                      type="submit"
                    >
                      {saving ? "Converting…" : "Convert to Query"}
                    </button>
                    {renderWhen(
                      error && !notesOverLimit,
                      <p aria-live="assertive" className="text-red-700 text-sm" role="alert">
                        {error}
                      </p>
                    )}
                  </form>
                  <div className="mt-5 grid gap-3 border-brand-border border-t pt-5">
                    <p className="font-semibold text-brand-dark">Dismiss from Pending Sales</p>
                    <label
                      className="grid gap-1 text-brand-dark text-sm"
                      htmlFor="inbound-dismissal-reason"
                    >
                      <span className="font-medium">Reason</span>
                      <Select
                        className="portal-input"
                        id="inbound-dismissal-reason"
                        onValueChange={setDismissalReason}
                        options={DISMISSAL_OPTIONS.map(([value, label]) => ({ label, value }))}
                        value={dismissalReason}
                      />
                    </label>
                    <button
                      className="portal-small-btn justify-center"
                      disabled={saving}
                      onClick={handleDismiss}
                      type="button"
                    >
                      {saving ? "Saving…" : "Dismiss lead"}
                    </button>
                  </div>
                </>,
                <p className="mt-5 text-brand-muted text-sm">{recordedOutcomeCopy(selected)}</p>
              )
            )}
          </>
        ) : (
          <div className="py-8 text-brand-muted text-sm">Select a lead to review its details.</div>
        )}
      </aside>
    </section>
  );
}
