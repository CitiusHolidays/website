"use client";

import { api } from "@convex/_generated/api";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useId, useState } from "react";
import { Button } from "@/components/ui/application-button";
import { Input, Textarea } from "@/components/ui/application-field";
import { inputVariants } from "@/components/ui/application-field-variants";
import { formatDisplayDate } from "@/lib/formatDate";
import { MoreRows, TravelHeader } from "./TravelWorkspaceUi";

type Profile = NonNullable<FunctionReturnType<typeof api.crm.externalTourManagerProfiles.get>>;
interface ProfileDraft {
  active: boolean;
  destinations: string;
  email: string;
  experienceSummary: string;
  experienceYears: string;
  name: string;
  phone: string;
  reportedPastTours: string;
  reportedPastToursNote: string;
  reportedPastToursSource: "self_reported" | "staff_recorded";
}
const blankProfile: ProfileDraft = {
  active: true,
  destinations: "",
  email: "",
  experienceSummary: "",
  experienceYears: "",
  name: "",
  phone: "",
  reportedPastTours: "",
  reportedPastToursNote: "",
  reportedPastToursSource: "self_reported",
};
function profileDraft(profile: Profile | null): ProfileDraft {
  return profile
    ? {
        ...profile,
        destinations: profile.destinations.join(", "),
        experienceYears: profile.experienceYears === null ? "" : String(profile.experienceYears),
        reportedPastTours:
          profile.reportedPastTours === null ? "" : String(profile.reportedPastTours),
      }
    : blankProfile;
}

function ProfileForm({
  profile,
  onSaved,
  onCancel,
}: {
  profile: Profile | null;
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(() => profileDraft(profile));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const create = useMutation(api.crm.externalTourManagerProfiles.create);
  const update = useMutation(api.crm.externalTourManagerProfiles.update);
  const change = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setDraft((current) => ({ ...current, [event.target.name]: event.target.value }));
  const active = (event: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((current) => ({ ...current, active: event.target.checked }));
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fields = {
        destinations: draft.destinations
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        email: draft.email,
        experienceSummary: draft.experienceSummary,
        experienceYears: draft.experienceYears ? Number(draft.experienceYears) : null,
        name: draft.name,
        phone: draft.phone,
        reportedPastTours: draft.reportedPastTours ? Number(draft.reportedPastTours) : null,
        reportedPastToursNote: draft.reportedPastToursNote,
        reportedPastToursSource: draft.reportedPastToursSource,
      };
      const result = profile
        ? await update({ ...fields, active: draft.active, profileId: profile.id })
        : await create(fields);
      onSaved(result.id);
    } catch (failure) {
      setError(
        travelError(
          failure,
          "The profile could not be saved. Your details are still here. Try again."
        )
      );
    }
    setBusy(false);
  };
  return (
    <form className={`${travelFormCard} space-y-6`} onSubmit={save}>
      <h2 className="font-heading font-semibold text-xl">
        {profile ? `Edit ${profile.name}` : "Add external tour manager"}
      </h2>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block space-y-1 sm:col-span-2" htmlFor={`${id}-name`}>
          <span className="font-semibold text-sm">Full name</span>
          <Input
            className="bg-white"
            disabled={busy}
            id={`${id}-name`}
            maxLength={160}
            name="name"
            onChange={change}
            required
            value={draft.name}
          />
        </label>
        <label className="block space-y-1" htmlFor={`${id}-email`}>
          <span className="font-semibold text-sm">Email</span>
          <Input
            autoComplete="email"
            className="bg-white"
            disabled={busy}
            id={`${id}-email`}
            name="email"
            onChange={change}
            type="email"
            value={draft.email}
          />
        </label>
        <label className="block space-y-1" htmlFor={`${id}-phone`}>
          <span className="font-semibold text-sm">Phone</span>
          <Input
            autoComplete="tel"
            className="bg-white"
            disabled={busy}
            id={`${id}-phone`}
            name="phone"
            onChange={change}
            placeholder="Include country code"
            type="tel"
            value={draft.phone}
          />
        </label>
      </div>
      <p className="text-brand-muted text-xs">
        Add an email or phone so the team can reuse the right person.
      </p>
      <label className="block space-y-1" htmlFor={`${id}-destinations`}>
        <span className="font-semibold text-sm">Destinations handled</span>
        <Input
          className="bg-white"
          disabled={busy}
          id={`${id}-destinations`}
          name="destinations"
          onChange={change}
          placeholder="Greece, Italy, Switzerland"
          value={draft.destinations}
        />
        <span className="text-brand-muted text-xs">
          Separate destinations with commas. Leave unknown experience blank.
        </span>
      </label>
      <label className="block space-y-1" htmlFor={`${id}-years`}>
        <span className="font-semibold text-sm">Years of experience, optional</span>
        <Input
          className="max-w-40 bg-white"
          disabled={busy}
          id={`${id}-years`}
          max={60}
          min={0}
          name="experienceYears"
          onChange={change}
          step="0.5"
          type="number"
          value={draft.experienceYears}
        />
      </label>
      <label className="block space-y-1" htmlFor={`${id}-summary`}>
        <span className="font-semibold text-sm">Tour experience</span>
        <Textarea
          className="bg-white"
          disabled={busy}
          id={`${id}-summary`}
          maxLength={1500}
          name="experienceSummary"
          onChange={change}
          placeholder="Group types, languages, local knowledge and relevant tour work"
          rows={4}
          value={draft.experienceSummary}
        />
      </label>
      <fieldset className="space-y-4 border-brand-border border-t pt-5">
        <legend className="font-heading font-semibold text-base">Reported history</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block space-y-1" htmlFor={`${id}-count`}>
            <span className="font-semibold text-sm">Past tours, optional</span>
            <Input
              className="bg-white"
              disabled={busy}
              id={`${id}-count`}
              max={10_000}
              min={0}
              name="reportedPastTours"
              onChange={change}
              step={1}
              type="number"
              value={draft.reportedPastTours}
            />
          </label>
          <label className="block space-y-1" htmlFor={`${id}-source`}>
            <span className="font-semibold text-sm">History source</span>
            <select
              className={`${inputVariants({ surface: "staff" })} bg-white`}
              disabled={busy}
              id={`${id}-source`}
              name="reportedPastToursSource"
              onChange={change}
              value={draft.reportedPastToursSource}
            >
              <option value="self_reported">Tour manager reported</option>
              <option value="staff_recorded">Staff recorded</option>
            </select>
          </label>
        </div>
        <label className="block space-y-1" htmlFor={`${id}-note`}>
          <span className="font-semibold text-sm">Source and context</span>
          <Textarea
            className="bg-white"
            disabled={busy}
            id={`${id}-note`}
            maxLength={1000}
            name="reportedPastToursNote"
            onChange={change}
            placeholder="Where this history came from and when it was recorded"
            required={draft.reportedPastTours !== ""}
            rows={3}
            value={draft.reportedPastToursNote}
          />
        </label>
      </fieldset>
      {profile ? (
        <label className="flex min-h-11 items-center gap-3">
          <input checked={draft.active} disabled={busy} onChange={active} type="checkbox" />
          <span className="text-sm">Use for new assignments</span>
        </label>
      ) : null}
      {error ? (
        <p className="text-red-700 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button disabled={busy} loading={busy} type="submit" variant="primary">
          Save profile
        </Button>
        <Button disabled={busy} onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
      </div>
    </form>
  );
}

function AssignmentForm({ profile }: { profile: Profile }) {
  const jobs = usePaginatedQuery(api.crm.postTourFeedback.listJobs, {}, { initialNumItems: 30 });
  const [jobCardId, setJob] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const create = useMutation(api.crm.ops.createTourManager);
  const choose = (event: React.ChangeEvent<HTMLSelectElement>) => setJob(event.target.value);
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await create({ externalProfileId: profile.id, jobCardId, name: profile.name });
      setJob("");
      setStatus("Assignment added.");
    } catch (failure) {
      setError(travelError(failure, "The assignment could not be added. Try again."));
    }
    setBusy(false);
  };
  return (
    <form className="mt-5 space-y-3 border-brand-border border-t pt-5" onSubmit={save}>
      <label className="block space-y-1">
        <span className="font-semibold text-sm">Assign to a Job Card</span>
        <select
          className={inputVariants({ surface: "staff" })}
          disabled={busy}
          onChange={choose}
          required
          value={jobCardId}
        >
          <option value="">Choose a Job Card</option>
          {jobs.results.map((job) => (
            <option key={job.jobCardId} value={job.jobCardId}>
              {job.jobCode} · {job.destination}
            </option>
          ))}
        </select>
      </label>
      <MoreRows loadMore={jobs.loadMore} status={jobs.status} />
      <Button disabled={busy} loading={busy} type="submit" variant="outline">
        Add assignment
      </Button>
      <p aria-live="polite" className="text-brand-muted text-sm empty:hidden" role="status">
        {status}
      </p>
      {error ? (
        <p className="text-red-700 text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function ExistingAssignmentLink({ profile }: { profile: Profile }) {
  const rows = usePaginatedQuery(api.crm.ops.listTourManagers, {}, { initialNumItems: 30 });
  const link = useMutation(api.crm.ops.updateTourManager);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const choose = (event: React.ChangeEvent<HTMLSelectElement>) => setSelected(event.target.value);
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await link({ externalProfileId: profile.id, tourManagerId: selected });
      setSelected("");
      setStatus("Existing assignment linked.");
    } catch (cause) {
      setError(travelError(cause, "The assignment could not be linked. Try again."));
    }
    setBusy(false);
  };
  return (
    <details className="mt-5 border-brand-border border-t pt-5">
      <summary className="min-h-11 cursor-pointer font-semibold text-sm focus-visible:outline-2 focus-visible:outline-citius-blue">
        Link an existing assignment
      </summary>
      <form className="space-y-3 pt-3" onSubmit={save}>
        <p className="text-brand-muted text-sm">
          Choose a previous external assignment for this person. Its contact details will use this
          profile.
        </p>
        <label className="block space-y-1">
          <span className="font-semibold text-sm">Unlinked assignment</span>
          <select
            className={inputVariants({ surface: "staff" })}
            disabled={busy}
            onChange={choose}
            required
            value={selected}
          >
            <option value="">Choose an assignment</option>
            {rows.results.map((row) =>
              row.staffId || row.externalProfileId ? null : (
                <option key={row.id} value={row.id}>
                  {row.name} · {row.jobCode || "No Job Card"}
                </option>
              )
            )}
          </select>
        </label>
        <MoreRows loadMore={rows.loadMore} status={rows.status} />
        <Button disabled={busy} loading={busy} type="submit" variant="outline">
          Link assignment
        </Button>
        <p aria-live="polite" className="text-brand-muted text-sm empty:hidden" role="status">
          {status}
        </p>
        {error ? (
          <p className="text-red-700 text-sm" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </details>
  );
}

function AssignmentHistory({ profile }: { profile: Profile }) {
  const rows = usePaginatedQuery(
    api.crm.externalTourManagerProfiles.listAssignments,
    { profileId: profile.id },
    { initialNumItems: 30 }
  );
  return (
    <section className={travelCard}>
      <h3 className="font-heading font-semibold text-lg">JC-linked assignments</h3>
      <p className="mt-2 text-brand-muted text-sm">
        These are linked assignment records. A recorded assignment does not confirm a completed
        tour.
      </p>
      {rows.status === "LoadingFirstPage" ? (
        <p className="mt-4" role="status">
          Loading assignments...
        </p>
      ) : null}
      {rows.status !== "LoadingFirstPage" && !rows.results.length ? (
        <p className="mt-4 text-brand-muted text-sm">No linked assignments visible to you.</p>
      ) : null}
      <ul className="mt-4 divide-y divide-brand-border">
        {rows.results.map((row) => (
          <li className="py-4" key={row.id}>
            <Link
              className="inline-flex min-h-11 items-center font-semibold text-citius-blue text-sm underline"
              href={`/portal/job-cards/${row.jobCardId}`}
            >
              {row.jobCode} · {row.destination}
            </Link>
            <p className="text-brand-muted text-sm">
              {row.clientName} · {row.status}
              {row.travelBatchLabel ? ` · ${row.travelBatchLabel}` : ""}
            </p>
            {row.travelStartDate ? (
              <p className="mt-1 text-brand-muted text-xs">
                {formatDisplayDate(row.travelStartDate)}
                {row.travelEndDate ? ` to ${formatDisplayDate(row.travelEndDate)}` : ""}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <MoreRows loadMore={rows.loadMore} status={rows.status} />
      {profile.canManage && profile.active ? <AssignmentForm profile={profile} /> : null}
      {profile.canManage ? <ExistingAssignmentLink profile={profile} /> : null}
    </section>
  );
}

function ProfileDetail({ id, onEdit }: { id: string; onEdit: (profile: Profile) => void }) {
  const profile = useQuery(api.crm.externalTourManagerProfiles.get, { profileId: id });
  if (profile === undefined) {
    return <p role="status">Loading profile...</p>;
  }
  if (!profile) {
    return <p className={travelCard}>This profile is no longer available.</p>;
  }
  const edit = () => onEdit(profile);
  return (
    <div className="min-w-0 space-y-5">
      <section className={travelCard}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="break-words font-heading font-semibold text-2xl">{profile.name}</h2>
            <p className="mt-1 text-brand-muted text-sm">
              External tour manager{profile.active ? "" : " · Inactive"}
            </p>
          </div>
          {profile.canManage ? (
            <Button onClick={edit} type="button" variant="outline">
              Edit profile
            </Button>
          ) : null}
        </div>
        <dl className="mt-5 grid gap-4 border-brand-border border-t pt-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-brand-muted">Email</dt>
            <dd className="mt-1 break-all">{profile.email || "Not recorded"}</dd>
          </div>
          <div>
            <dt className="text-brand-muted">Phone</dt>
            <dd className="mt-1 break-words">{profile.phone || "Not recorded"}</dd>
          </div>
        </dl>
        <h3 className="mt-6 font-semibold text-sm">Destinations handled</h3>
        <p className="mt-2 break-words text-brand-muted text-sm">
          {profile.destinations.join(" · ") || "Not recorded"}
        </p>
        <h3 className="mt-6 font-semibold text-sm">Tour experience</h3>
        {profile.experienceYears === null ? null : (
          <p className="mt-2 text-brand-muted text-sm">{profile.experienceYears} years recorded</p>
        )}
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">
          {profile.experienceSummary || "No experience notes recorded."}
        </p>
        <div className="mt-6 rounded-2xl bg-[#FDFBF7] p-4">
          <h3 className="font-semibold text-sm">Reported history</h3>
          <p className="mt-2 text-brand-muted text-sm">
            {profile.reportedPastTours === null
              ? "Past-tour count not recorded"
              : `${profile.reportedPastTours} past tours · ${profile.reportedPastToursSource === "self_reported" ? "Tour manager reported" : "Staff recorded"}`}
          </p>
          {profile.reportedPastToursNote ? (
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">
              {profile.reportedPastToursNote}
            </p>
          ) : null}
        </div>
      </section>
      <AssignmentHistory key={profile.id} profile={profile} />
    </div>
  );
}

export default function ExternalTourManagersWorkspace() {
  const access = useQuery(api.crm.externalTourManagerProfiles.getAccess, {});
  const [includeInactive, setInactive] = useState(false);
  const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState<Profile | "new" | null>(null);
  const [status, setStatus] = useState("");
  const profiles = usePaginatedQuery(
    api.crm.externalTourManagerProfiles.list,
    { includeInactive },
    { initialNumItems: 30 }
  );
  const choose = (event: React.MouseEvent<HTMLButtonElement>) => {
    setSelected(event.currentTarget.dataset.profileId ?? "");
    setEditing(null);
  };
  const add = () => {
    setEditing("new");
    setStatus("");
  };
  const edit = (profile: Profile) => {
    setEditing(profile);
    setStatus("");
  };
  const cancel = () => setEditing(null);
  const saved = (id: string) => {
    setSelected(id);
    setEditing(null);
    setStatus("Profile saved.");
  };
  const inactive = (event: React.ChangeEvent<HTMLInputElement>) =>
    setInactive(event.target.checked);
  const selectedId = selected || profiles.results[0]?.id;
  return (
    <div className="mx-auto max-w-6xl space-y-6 font-sans text-brand-dark">
      <TravelHeader title="External tour managers">
        Keep contact details and tour experience in one place, ready for the next assignment.
      </TravelHeader>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <label className="flex min-h-11 items-center gap-3">
          <input checked={includeInactive} onChange={inactive} type="checkbox" />
          <span className="text-sm">Include inactive profiles</span>
        </label>
        {access?.canManage ? (
          <Button onClick={add} type="button" variant="primary">
            Add profile
          </Button>
        ) : null}
      </div>
      <p aria-live="polite" className="text-brand-muted text-sm empty:hidden" role="status">
        {status}
      </p>
      {profiles.status === "LoadingFirstPage" ? <p role="status">Loading profiles...</p> : null}
      {!editing && profiles.status !== "LoadingFirstPage" && !profiles.results.length ? (
        <p className={travelCard}>No external tour-manager profiles yet.</p>
      ) : null}
      <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="min-w-0">
          <ul className="space-y-3">
            {profiles.results.map((profile) => (
              <li key={profile.id}>
                <button
                  aria-pressed={selectedId === profile.id && !editing}
                  className={`w-full rounded-2xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-citius-blue ${selectedId === profile.id && !editing ? "border-[#0B1026]/30 bg-[#FDFBF7]" : "border-brand-border bg-white hover:bg-[#FDFBF7]"}`}
                  data-profile-id={profile.id}
                  onClick={choose}
                  type="button"
                >
                  <span className="block break-words font-heading font-semibold text-base">
                    {profile.name}
                  </span>
                  <span className="mt-1 block break-words text-brand-muted text-sm">
                    {profile.destinations.join(" · ") || "Destinations not recorded"}
                  </span>
                  {profile.active ? null : (
                    <span className="mt-2 block text-brand-muted text-xs">Inactive</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <MoreRows loadMore={profiles.loadMore} status={profiles.status} />
        </div>
        {editing ? (
          <ProfileForm
            key={editing === "new" ? "new" : editing.id}
            onCancel={cancel}
            onSaved={saved}
            profile={editing === "new" ? null : editing}
          />
        ) : null}
        {!editing && selectedId ? <ProfileDetail id={selectedId} onEdit={edit} /> : null}
      </div>
    </div>
  );
}

import { travelCard, travelError, travelFormCard } from "./travelPresentation";
