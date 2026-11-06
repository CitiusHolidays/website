"use client";

import { api } from "@convex/_generated/api";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/application-button";
import { Input } from "@/components/ui/application-field";
import { inputVariants } from "@/components/ui/application-field-variants";
import { formatDisplayDate } from "@/lib/formatDate";
import { propertiesWhen } from "@/lib/runtimeValues";
import { useActiveLocalReferenceDate } from "../workspace/usePortalReferenceClock";
import { MoreRows, TravelHeader, TravelViewSwitch } from "./TravelWorkspaceUi";

type Trip = FunctionReturnType<typeof api.crm.staffTravel.list>["page"][number];
interface TripDraft {
  destination: string;
  endDate: string;
  jobCardId: string;
  staffId: string;
  startDate: string;
}
const emptyTrip: TripDraft = {
  destination: "",
  endDate: "",
  jobCardId: "",
  staffId: "",
  startDate: "",
};

function PersonPicker({
  disabled,
  value,
  onChange,
}: {
  disabled: boolean;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  const people = usePaginatedQuery(api.crm.staffTravel.listPeople, {}, { initialNumItems: 30 });
  return (
    <div>
      <label className="block space-y-1">
        <span className="font-semibold text-sm">Person</span>
        <select
          className={`${inputVariants({ surface: "staff" })} bg-white`}
          disabled={disabled}
          onChange={onChange}
          value={value}
        >
          <option value="">Myself</option>
          {people.results.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </label>
      <MoreRows label="Load more people" loadMore={people.loadMore} status={people.status} />
    </div>
  );
}

function TripForm({
  trip,
  canManageOthers,
  onDone,
  onSaved,
}: {
  trip: Trip | null;
  canManageOthers: boolean;
  onDone: () => void;
  onSaved: () => void;
}) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const [draft, setDraft] = useState<TripDraft>(
    trip ? { ...trip, jobCardId: trip.jobCardId ?? "" } : emptyTrip
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const create = useMutation(api.crm.staffTravel.create);
  const update = useMutation(api.crm.staffTravel.update);
  const jobs = usePaginatedQuery(api.crm.staffTravel.listJobOptions, {}, { initialNumItems: 30 });
  const change = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft((current) => ({ ...current, [event.target.name]: event.target.value }));
  const person = (event: React.ChangeEvent<HTMLSelectElement>) =>
    setDraft((current) => ({ ...current, staffId: event.target.value }));
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fields = {
        destination: draft.destination,
        endDate: draft.endDate,
        jobCardId: draft.jobCardId,
        startDate: draft.startDate,
      };
      if (trip) {
        await update({ ...fields, travelId: trip.id });
      } else {
        await create({
          ...fields,
          ...propertiesWhen(draft.staffId, () => ({ staffId: draft.staffId })),
        });
      }
      onSaved();
    } catch (failure) {
      setError(
        travelError(failure, "Travel could not be saved. Your details are still here. Try again.")
      );
    }
    setBusy(false);
  };
  return (
    <form className="space-y-5" onSubmit={save}>
      <h2 className="font-heading font-semibold text-lg outline-none" ref={heading} tabIndex={-1}>
        {trip ? `Edit ${trip.personName}'s trip` : "Add travel"}
      </h2>
      {canManageOthers && !trip ? (
        <PersonPicker disabled={busy} onChange={person} value={draft.staffId} />
      ) : null}
      <label className="block space-y-1" htmlFor={`${id}-destination`}>
        <span className="font-semibold text-sm">Destination</span>
        <Input
          className="bg-white"
          disabled={busy}
          id={`${id}-destination`}
          maxLength={160}
          name="destination"
          onChange={change}
          placeholder="City or region"
          required
          value={draft.destination}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <label className="block space-y-1" htmlFor={`${id}-start`}>
          <span className="font-semibold text-sm">From</span>
          <Input
            className="bg-white"
            disabled={busy}
            id={`${id}-start`}
            name="startDate"
            onChange={change}
            required
            type="date"
            value={draft.startDate}
          />
        </label>
        <label className="block space-y-1" htmlFor={`${id}-end`}>
          <span className="font-semibold text-sm">Through</span>
          <Input
            className="bg-white"
            disabled={busy}
            id={`${id}-end`}
            min={draft.startDate}
            name="endDate"
            onChange={change}
            required
            type="date"
            value={draft.endDate}
          />
        </label>
      </div>
      <label className="block space-y-1" htmlFor={`${id}-job`}>
        <span className="font-semibold text-sm">Job Card, optional</span>
        <select
          className={`${inputVariants({ surface: "staff" })} bg-white`}
          disabled={busy}
          id={`${id}-job`}
          name="jobCardId"
          onChange={change}
          value={draft.jobCardId}
        >
          <option value="">No Job Card</option>
          {trip?.jobCardId && !jobs.results.some((job) => job.jobCardId === trip.jobCardId) ? (
            <option value={trip.jobCardId}>{trip.jobCode}</option>
          ) : null}
          {jobs.results.map((job) => (
            <option key={job.jobCardId} value={job.jobCardId}>
              {job.jobCode} · {job.destination}
            </option>
          ))}
        </select>
      </label>
      <MoreRows label="Load more Job Cards" loadMore={jobs.loadMore} status={jobs.status} />
      <p className="text-brand-muted text-xs leading-relaxed">
        The team can see your destination and dates. Add leave separately if needed.
      </p>
      {error ? (
        <p className="text-red-700 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button disabled={busy} loading={busy} type="submit" variant="primary">
          Save travel
        </Button>
        <Button disabled={busy} onClick={onDone} type="button" variant="outline">
          Close without saving
        </Button>
      </div>
    </form>
  );
}

type TripGroupKey = "later" | "now" | "past" | "soon";
type TravelView = "mine" | "team";

const TRAVEL_VIEWS: readonly { label: string; value: TravelView }[] = [
  { label: "Team travel", value: "team" },
  { label: "My trips", value: "mine" },
];

const TRIP_GROUPS: readonly { key: TripGroupKey; label: string }[] = [
  { key: "now", label: "Travelling now" },
  { key: "soon", label: "Next 7 days" },
  { key: "later", label: "Later" },
  { key: "past", label: "Past and cancelled" },
];

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function tripGroup(trip: Trip, referenceDate: string, weekEnd: string): TripGroupKey {
  if (trip.status === "cancelled" || trip.endDate < referenceDate) {
    return "past";
  }
  if (trip.isCurrent || trip.startDate <= referenceDate) {
    return "now";
  }
  return trip.startDate <= weekEnd ? "soon" : "later";
}

function groupTrips(trips: readonly Trip[], referenceDate: string) {
  const weekEnd = addDays(referenceDate, 7);
  const groups = new Map<TripGroupKey, Trip[]>();
  for (const trip of trips) {
    const key = tripGroup(trip, referenceDate, weekEnd);
    const rows = groups.get(key);
    if (rows) {
      rows.push(trip);
    } else {
      groups.set(key, [trip]);
    }
  }
  return TRIP_GROUPS.flatMap(({ key, label }) => {
    const rows = groups.get(key);
    if (!rows) {
      return [];
    }
    const sorted = rows.sort((left, right) =>
      key === "past"
        ? right.startDate.localeCompare(left.startDate)
        : left.startDate.localeCompare(right.startDate)
    );
    return [{ key, label, trips: sorted }];
  });
}

function tripPill(trip: Trip, referenceDate: string) {
  if (trip.status === "cancelled") {
    return "Cancelled";
  }
  return trip.endDate < referenceDate ? "Past trip" : "";
}

function TripSummary({ trip, referenceDate }: { trip: Trip; referenceDate: string }) {
  const pill = tripPill(trip, referenceDate);
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="break-words font-semibold text-brand-dark">{trip.personName}</span>
        {pill ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 text-xs">
            {pill}
          </span>
        ) : null}
      </p>
      <p className="mt-0.5 break-words text-brand-muted text-sm">
        <span className="text-brand-dark">{trip.destination}</span>
        {" · "}
        <span className="whitespace-nowrap tabular-nums">
          {formatDisplayDate(trip.startDate)} to {formatDisplayDate(trip.endDate)}
        </span>
        {trip.jobCardId ? (
          <>
            {" · "}
            <Link
              className="whitespace-nowrap text-citius-blue underline underline-offset-2"
              href={`/portal/job-cards/${trip.jobCardId}`}
            >
              <span className="sr-only">Job Card </span>
              {trip.jobCode}
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}

function TripRow({
  trip,
  onEdit,
  referenceDate,
}: {
  trip: Trip;
  onEdit: (trip: Trip) => void;
  referenceDate: string;
}) {
  const cancel = useMutation(api.crm.staffTravel.cancel);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const keepButton = useRef<HTMLButtonElement>(null);
  const askButton = useRef<HTMLButtonElement>(null);
  const ask = () => {
    setConfirming(true);
    queueMicrotask(() => keepButton.current?.focus());
  };
  const keep = () => {
    setConfirming(false);
    queueMicrotask(() => askButton.current?.focus());
  };
  const edit = () => onEdit(trip);
  const cancelTrip = async () => {
    setBusy(true);
    setError("");
    try {
      await cancel({ travelId: trip.id });
      setConfirming(false);
    } catch (failure) {
      setError(travelError(failure, "Travel could not be cancelled. Try again."));
    }
    setBusy(false);
  };
  return (
    <li className="grid gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
      <TripSummary referenceDate={referenceDate} trip={trip} />
      {trip.canManage && trip.status !== "cancelled" ? (
        <div className="flex flex-wrap items-center gap-2">
          {confirming ? (
            <>
              <span className="text-sm">Cancel this trip? It leaves team travel.</span>
              <Button disabled={busy} onClick={keep} ref={keepButton} type="button" variant="small">
                Keep trip
              </Button>
              <Button disabled={busy} onClick={cancelTrip} type="button" variant="danger">
                Cancel trip
              </Button>
            </>
          ) : (
            <>
              <Button
                aria-label={`Edit trip for ${trip.personName}`}
                disabled={busy}
                onClick={edit}
                type="button"
                variant="small"
              >
                Edit trip
              </Button>
              <Button
                aria-label={`Cancel trip for ${trip.personName}`}
                className="min-h-11 rounded-lg px-2 text-brand-muted text-sm transition-colors hover:text-red-700"
                onClick={ask}
                ref={askButton}
                type="button"
              >
                Cancel trip
              </Button>
            </>
          )}
        </div>
      ) : null}
      {error ? (
        <p className="text-red-700 text-sm sm:col-span-2" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function ScheduleRows({ view, onEdit }: { view: TravelView; onEdit: (trip: Trip) => void }) {
  const referenceDate = useActiveLocalReferenceDate(true);
  const mine = view === "mine";
  const trips = usePaginatedQuery(
    mine ? api.crm.staffTravel.listMine : api.crm.staffTravel.list,
    { referenceDate },
    { initialNumItems: 30 }
  );
  const groups = groupTrips(trips.results, referenceDate);
  return (
    <section aria-labelledby={`travel-${view}-heading`} className="min-w-0 space-y-6">
      <h2 className="sr-only" id={`travel-${view}-heading`}>
        {mine ? "My trips" : "Team travel"}
      </h2>
      {trips.status === "LoadingFirstPage" ? <p role="status">Loading travel...</p> : null}
      {trips.status !== "LoadingFirstPage" && trips.results.length === 0 ? (
        <p className={travelCard}>
          {mine ? "You have no trips recorded." : "No current or upcoming team travel."}
        </p>
      ) : null}
      {groups.map((group) => (
        <section aria-labelledby={`travel-${view}-${group.key}`} key={group.key}>
          <h3
            className="mb-2 flex items-baseline gap-2 font-heading font-semibold text-base"
            id={`travel-${view}-${group.key}`}
          >
            {group.label}
            <span
              aria-hidden="true"
              className="font-normal font-sans text-brand-muted text-sm tabular-nums"
            >
              {group.trips.length}
            </span>
            <span className="sr-only">
              , {group.trips.length} {group.trips.length === 1 ? "trip" : "trips"}
            </span>
          </h3>
          <ul className="divide-y divide-brand-border rounded-xl border border-brand-border bg-white">
            {group.trips.map((trip) => (
              <TripRow key={trip.id} onEdit={onEdit} referenceDate={referenceDate} trip={trip} />
            ))}
          </ul>
        </section>
      ))}
      <MoreRows label="Load more trips" loadMore={trips.loadMore} status={trips.status} />
    </section>
  );
}

export default function StaffTravelWorkspace() {
  const access = useQuery(api.crm.staffTravel.getAccess, {});
  const [view, setView] = useState<TravelView>("team");
  const [form, setForm] = useState<Trip | "new" | null>(null);
  const [status, setStatus] = useState("");
  const addButton = useRef<HTMLButtonElement>(null);
  const formWasOpen = useRef(false);
  useEffect(() => {
    if (form) {
      formWasOpen.current = true;
    } else if (formWasOpen.current) {
      formWasOpen.current = false;
      addButton.current?.focus();
    }
  }, [form]);
  const close = () => setForm(null);
  const add = () => {
    setForm("new");
    setStatus("");
  };
  const edit = (trip: Trip) => {
    setForm(trip);
    setStatus("");
  };
  const done = close;
  const saved = () => {
    close();
    setStatus("Travel saved.");
  };
  return (
    <div className="mx-auto max-w-6xl space-y-6 font-sans text-brand-dark">
      <TravelHeader title="Travel schedule">
        See who is away, where they are going and when they return.
      </TravelHeader>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-brand-border border-b">
        <TravelViewSwitch
          label="Travel view"
          onChange={setView}
          options={TRAVEL_VIEWS}
          value={view}
        />
        {access?.staffId && !form ? (
          <Button className="mb-2" onClick={add} ref={addButton} type="button" variant="primary">
            Add travel
          </Button>
        ) : null}
      </div>
      <p aria-live="polite" className="text-sm empty:hidden" role="status">
        {status}
      </p>
      <div className={form ? "grid items-start gap-6 xl:grid-cols-[340px_minmax(0,1fr)]" : ""}>
        {form ? (
          <div className={travelFormCard}>
            <TripForm
              canManageOthers={access?.canManageOthers ?? false}
              key={form === "new" ? "new" : form.id}
              onDone={done}
              onSaved={saved}
              trip={form === "new" ? null : form}
            />
          </div>
        ) : null}
        <ScheduleRows key={view} onEdit={edit} view={view} />
      </div>
    </div>
  );
}

import { travelCard, travelError, travelFormCard } from "./travelPresentation";
