"use client";

import { api } from "@convex/_generated/api";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useId, useState } from "react";
import { Button } from "@/components/ui/application-button";
import { Input } from "@/components/ui/application-field";
import { inputVariants } from "@/components/ui/application-field-variants";
import { formatDisplayDate } from "@/lib/formatDate";
import { propertiesWhen } from "@/lib/runtimeValues";
import { useActiveLocalReferenceDate } from "../workspace/usePortalReferenceClock";
import { MoreRows, TravelHeader } from "./TravelWorkspaceUi";

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
      <MoreRows loadMore={people.loadMore} status={people.status} />
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
      <h2 className="font-heading font-semibold text-lg">
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
      <MoreRows loadMore={jobs.loadMore} status={jobs.status} />
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
          Cancel
        </Button>
      </div>
    </form>
  );
}

function tripStatusLabel(trip: Trip, referenceDate: string) {
  if (trip.status === "cancelled") {
    return "Cancelled";
  }
  if (trip.isCurrent) {
    return "Travelling now";
  }
  return trip.endDate < referenceDate ? "Past trip" : "Upcoming";
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
  const ask = () => setConfirming(true);
  const keep = () => setConfirming(false);
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
    <li
      className={`${travelCard} flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center`}
    >
      <div className="w-full min-w-0 flex-1 sm:w-auto">
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <h3 className="break-words font-heading font-semibold text-lg">{trip.personName}</h3>
          <span
            className={`rounded-full px-2.5 py-1 text-xs ${trip.status === "cancelled" ? "bg-slate-100 text-slate-600" : "bg-[#FDFBF7] text-brand-muted"}`}
          >
            {tripStatusLabel(trip, referenceDate)}
          </span>
        </div>
        <p className="mt-1 break-words text-brand-dark text-sm">{trip.destination}</p>
        <p className="mt-2 text-brand-muted text-sm">
          {formatDisplayDate(trip.startDate)} to {formatDisplayDate(trip.endDate)}
        </p>
        {trip.jobCardId ? (
          <Link
            className="mt-2 inline-flex min-h-11 items-center text-citius-blue text-sm underline"
            href={`/portal/job-cards/${trip.jobCardId}`}
          >
            {trip.jobCode}
          </Link>
        ) : null}
      </div>
      {trip.canManage && trip.status !== "cancelled" ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={busy} onClick={edit} type="button" variant="outline">
            Edit travel
          </Button>
          {confirming ? (
            <>
              <span className="text-sm">Cancel this trip?</span>
              <Button disabled={busy} onClick={cancelTrip} type="button" variant="danger">
                Cancel trip
              </Button>
              <Button disabled={busy} onClick={keep} type="button" variant="outline">
                Keep trip
              </Button>
            </>
          ) : (
            <Button onClick={ask} type="button" variant="bare">
              Cancel trip
            </Button>
          )}
        </div>
      ) : null}
      {error ? (
        <p className="w-full text-red-700 text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function ScheduleRows({ mine, onEdit }: { mine: boolean; onEdit: (trip: Trip) => void }) {
  const referenceDate = useActiveLocalReferenceDate(true);
  const trips = usePaginatedQuery(
    mine ? api.crm.staffTravel.listMine : api.crm.staffTravel.list,
    { referenceDate },
    { initialNumItems: 30 }
  );
  return (
    <section aria-label={mine ? "My travel" : "Team travel"} className="min-w-0">
      <h2 className="mb-4 font-heading font-semibold text-lg">
        {mine ? "My travel" : "Current and upcoming travel"}
      </h2>
      {trips.status === "LoadingFirstPage" ? <p role="status">Loading travel...</p> : null}
      {trips.status !== "LoadingFirstPage" && trips.results.length === 0 ? (
        <p className={travelCard}>
          {mine ? "You have no travel recorded." : "No current or upcoming travel recorded."}
        </p>
      ) : null}
      <ul className="space-y-4">
        {trips.results.map((trip) => (
          <TripRow key={trip.id} onEdit={onEdit} referenceDate={referenceDate} trip={trip} />
        ))}
      </ul>
      <MoreRows loadMore={trips.loadMore} status={trips.status} />
    </section>
  );
}

export default function StaffTravelWorkspace() {
  const access = useQuery(api.crm.staffTravel.getAccess, {});
  const [mine, setMine] = useState(false);
  const [form, setForm] = useState<Trip | "new" | null>(null);
  const [status, setStatus] = useState("");
  const all = () => setMine(false);
  const my = () => setMine(true);
  const add = () => {
    setForm("new");
    setStatus("");
  };
  const edit = (trip: Trip) => {
    setForm(trip);
    setStatus("");
  };
  const done = () => setForm(null);
  const saved = () => {
    setForm(null);
    setStatus("Travel saved.");
  };
  return (
    <div className="mx-auto max-w-6xl space-y-6 font-sans text-brand-dark">
      <TravelHeader title="Travel schedule">
        See who is away, where they are going and when they return.
      </TravelHeader>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <fieldset aria-label="Travel view" className="flex flex-wrap gap-2">
          <Button
            aria-pressed={!mine}
            onClick={all}
            type="button"
            variant={mine ? "outline" : "primary"}
          >
            Team travel
          </Button>
          <Button
            aria-pressed={mine}
            onClick={my}
            type="button"
            variant={mine ? "primary" : "outline"}
          >
            My trips
          </Button>
        </fieldset>
        {access?.staffId ? (
          <Button onClick={add} type="button" variant="outline">
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
        <ScheduleRows key={String(mine)} mine={mine} onEdit={edit} />
      </div>
    </div>
  );
}

import { travelCard, travelError, travelFormCard } from "./travelPresentation";
