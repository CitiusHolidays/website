"use client";

import { api } from "@convex/_generated/api";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const STATUS_OPTIONS = [
  ["pending", "Pending"],
  ["converted", "Converted"],
  ["dismissed", "Dismissed"],
];
const SOURCE_OPTIONS = [
  ["", "All sources"],
  ["Citius Concierge", "Citius Concierge"],
  ["Sacred Bharat", "Sacred Bharat"],
];
const QUERY_TYPES = ["FIT", "Family Group", "MICE", "MICE Bidding", "B2B", "Spiritual"];
const TRAVEL_TYPES = ["Domestic Travel", "International Travel"];

function formatCreatedAt(value) {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formFromIntent(intent) {
  return {
    budgetAmount: "",
    clientName: intent?.clientName || "",
    contactMobile: intent?.contactMobile || "",
    contactPerson: "",
    destination: intent?.destination || "",
    notes: intent?.notes || "",
    paxCount: String(intent?.paxCount || 1),
    queryType: "FIT",
    salesOwnerName: "",
    salesOwnerStaffId: "",
    travelEndDate: "",
    travelStartDate: intent?.travelStartDate || "",
    travelType: "International Travel",
  };
}

function fieldLabel(label, children) {
  return (
    <label className="grid gap-1 text-brand-dark text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

export function InboundLeadsView({ allowed, canFetch }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkedId =
    searchParams.get("open") === "inboundIntent" ? searchParams.get("id") : null;
  const [status, setStatus] = useState("pending");
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(deepLinkedId);
  const [form, setForm] = useState(() => formFromIntent(null));
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

  useEffect(() => {
    if (deepLinkedId) {
      setSelectedId(deepLinkedId);
    }
  }, [deepLinkedId]);

  useEffect(() => {
    if (selected) {
      setForm(formFromIntent(selected));
      setError("");
      setMessage("");
    }
  }, [selected]);

  if (!shouldFetch) {
    return null;
  }

  const rows = page.results || [];
  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  async function handleConvert(event) {
    event.preventDefault();
    if (!selectedId || selected?.status !== "pending") {
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await convert({
        ...form,
        budgetAmount: form.budgetAmount ? Number(form.budgetAmount) : undefined,
        intentId: selectedId,
        paxCount: Number(form.paxCount),
      });
      setMessage(`${result.queryCode} created and linked to this inbound lead.`);
      router.replace("/portal/inbound-leads");
    } catch (conversionError) {
      setError(
        conversionError?.data || conversionError?.message || "Unable to convert this lead."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]">
      <div className="rounded-2xl border border-brand-border bg-white shadow-sm">
        <div className="flex flex-wrap items-end gap-3 border-brand-border border-b p-4">
          <label className="grid min-w-36 gap-1 text-brand-dark text-sm">
            <span className="font-medium">Status</span>
            <select
              className="portal-input"
              onChange={(event) => setStatus(event.target.value)}
              value={status}
            >
              {STATUS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-44 gap-1 text-brand-dark text-sm">
            <span className="font-medium">Source</span>
            <select
              className="portal-input"
              onChange={(event) => setSource(event.target.value)}
              value={source}
            >
              {SOURCE_OPTIONS.map(([value, label]) => (
                <option key={label} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-52 flex-1 gap-1 text-brand-dark text-sm">
            <span className="font-medium">Search</span>
            <input
              className="portal-input"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, destination, email"
              value={search}
            />
          </label>
          <span className="pb-2 text-brand-muted text-xs">{rows.length} loaded</span>
        </div>
        {rows.length === 0 ? (
          <p className="p-8 text-brand-muted text-sm">No inbound leads match these filters.</p>
        ) : (
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
                  <tr className={row._id === selectedId ? "bg-citius-blue/5" : ""} key={row._id}>
                    <td className="px-4 py-3 align-top">
                      <div className="font-semibold text-brand-dark">{row.clientName}</div>
                      <div className="mt-1 text-brand-muted text-xs">
                        {row.contactEmail || row.contactMobile || "No contact supplied"}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-brand-muted">
                      <div>{row.destination || "Destination TBD"}</div>
                      <div className="mt-1 text-xs">{row.source}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-brand-muted">
                      {formatCreatedAt(row.createdAt)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <button
                        className="portal-small-btn"
                        onClick={() => setSelectedId(row._id)}
                        type="button"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {page.status === "CanLoadMore" ? (
          <div className="border-brand-border border-t p-4">
            <button className="portal-small-btn" onClick={() => page.loadMore(50)} type="button">
              Load more leads
            </button>
          </div>
        ) : null}
      </div>

      <aside className="rounded-2xl border border-brand-border bg-white p-5 shadow-sm">
        {!selected ? (
          <div className="py-8 text-brand-muted text-sm">Select a lead to review its details.</div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-brand-dark text-lg">{selected.clientName}</p>
                <p className="mt-1 text-brand-muted text-xs">
                  {selected.source} · received {formatCreatedAt(selected.createdAt)}
                </p>
              </div>
              <span className="rounded-full bg-brand-light px-2.5 py-1 font-semibold text-brand-muted text-xs capitalize">
                {selected.status}
              </span>
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
              <div>
                <dt className="text-brand-muted text-xs">Notes</dt>
                <dd className="whitespace-pre-wrap text-brand-dark">{selected.notes || "—"}</dd>
              </div>
            </dl>
            {selected.status === "pending" ? (
              <form className="mt-5 grid gap-3" onSubmit={handleConvert}>
                <p className="font-semibold text-brand-dark">Convert to Sales Query</p>
                {fieldLabel(
                  "Client name",
                  <input
                    className="portal-input"
                    onChange={(event) => setField("clientName", event.target.value)}
                    required
                    value={form.clientName}
                  />
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {fieldLabel(
                    "Destination",
                    <input
                      className="portal-input"
                      onChange={(event) => setField("destination", event.target.value)}
                      value={form.destination}
                    />
                  )}
                  {fieldLabel(
                    "Pax",
                    <input
                      className="portal-input"
                      min="1"
                      onChange={(event) => setField("paxCount", event.target.value)}
                      required
                      type="number"
                      value={form.paxCount}
                    />
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {fieldLabel(
                    "Query type",
                    <select
                      className="portal-input"
                      onChange={(event) => setField("queryType", event.target.value)}
                      value={form.queryType}
                    >
                      {QUERY_TYPES.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  )}
                  {fieldLabel(
                    "Travel type",
                    <select
                      className="portal-input"
                      onChange={(event) => setField("travelType", event.target.value)}
                      value={form.travelType}
                    >
                      {TRAVEL_TYPES.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {fieldLabel(
                    "Travel start",
                    <input
                      className="portal-input"
                      onChange={(event) => setField("travelStartDate", event.target.value)}
                      type="date"
                      value={form.travelStartDate}
                    />
                  )}
                  {fieldLabel(
                    "Travel end",
                    <input
                      className="portal-input"
                      onChange={(event) => setField("travelEndDate", event.target.value)}
                      type="date"
                      value={form.travelEndDate}
                    />
                  )}
                </div>
                {fieldLabel(
                  "Notes",
                  <textarea
                    className="portal-input min-h-24"
                    onChange={(event) => setField("notes", event.target.value)}
                    value={form.notes}
                  />
                )}
                <button className="portal-primary-btn justify-center" disabled={saving} type="submit">
                  {saving ? "Converting…" : "Convert to Query"}
                </button>
                {error ? <p className="text-red-700 text-sm">{error}</p> : null}
                {message ? <p className="text-emerald-700 text-sm">{message}</p> : null}
              </form>
            ) : (
              <p className="mt-5 text-brand-muted text-sm">
                This lead is already {selected.status}. It cannot be converted again.
              </p>
            )}
          </>
        )}
      </aside>
    </section>
  );
}
