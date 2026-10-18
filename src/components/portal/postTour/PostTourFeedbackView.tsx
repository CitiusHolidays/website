"use client";

import {
  POST_TOUR_FEEDBACK_CATEGORIES,
  type postTourFeedbackValidator,
  type postTourJobValidator,
} from "@convex/lib/postTourFeedbackValidators";
import type { Infer } from "convex/values";
import Image from "next/image";
import { useId, useState } from "react";
import { Button } from "@/components/ui/application-button";
import { Input, Textarea } from "@/components/ui/application-field";
import { inputVariants } from "@/components/ui/application-field-variants";
import { formatDisplayDate } from "@/lib/formatDate";

export type FeedbackEntry = Infer<typeof postTourFeedbackValidator>;
export type FeedbackJob = Infer<typeof postTourJobValidator> & { canCompose: boolean };
export type FeedbackDraft = Pick<
  FeedbackEntry,
  "category" | "comment" | "vendorName" | "vendorRating"
>;

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const emptyDraft: FeedbackDraft = {
  category: "overall",
  comment: "",
  vendorName: "",
  vendorRating: null,
};
const categoryLabels = new Map(
  POST_TOUR_FEEDBACK_CATEGORIES.map((item) => [item.value, item.label])
);

export function FeedbackPhotoPreview({
  photo,
  category,
  basePath = "/api/portal/files/post-tour",
}: {
  basePath?: string;
  photo: { id: string; fileName: string };
  category: string;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const fail = () => setFailed(true);
  const retry = () => {
    setAttempt((current) => current + 1);
    setFailed(false);
  };
  if (failed) {
    return (
      <div className="rounded-xl border border-brand-border p-3 text-brand-muted text-xs">
        <p>Photo could not be loaded.</p>
        <Button
          className="mt-2 min-h-11"
          onClick={retry}
          surface="staff"
          type="button"
          variant="outline"
        >
          Retry photo
        </Button>
      </div>
    );
  }
  return (
    <a
      className="block overflow-hidden rounded-xl border border-brand-border bg-[#FDFBF7] focus-visible:outline-2 focus-visible:outline-citius-blue"
      href={`${basePath}/${encodeURIComponent(photo.id)}`}
      rel="noopener noreferrer"
      target="_blank"
    >
      <Image
        alt={`${category}: ${photo.fileName}`}
        className="aspect-[4/3] w-full object-cover"
        height={300}
        key={attempt}
        loading="lazy"
        onError={fail}
        src={`${basePath}/${encodeURIComponent(photo.id)}?inline=1&retry=${attempt}`}
        unoptimized
        width={400}
      />
      <span className="block truncate px-3 py-2.5 text-brand-muted text-xs">{photo.fileName}</span>
    </a>
  );
}

function FeedbackForm({
  initial = emptyDraft,
  onCancel,
  onSave,
}: {
  initial?: FeedbackDraft;
  onCancel?: () => void;
  onSave: (draft: FeedbackDraft) => Promise<void>;
}) {
  const id = useId();
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(draft);
      setDraft(emptyDraft);
    } catch {
      setError("Feedback could not be saved. Your text is still here. Try again.");
    }
    setSaving(false);
  };
  const setCategory = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const category = POST_TOUR_FEEDBACK_CATEGORIES.find(
      (item) => item.value === event.target.value
    )?.value;
    if (category) {
      setDraft((current) => ({ ...current, category }));
    }
  };
  const setComment = (event: React.ChangeEvent<HTMLTextAreaElement>) =>
    setDraft((current) => ({ ...current, comment: event.target.value }));
  const setVendor = (event: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((current) => ({ ...current, vendorName: event.target.value }));
  const setRating = (event: React.ChangeEvent<HTMLSelectElement>) =>
    setDraft((current) => ({
      ...current,
      vendorRating: event.target.value ? Number(event.target.value) : null,
    }));
  return (
    <form className="space-y-4" onSubmit={save}>
      <label className="block space-y-1" htmlFor={`${id}-category`}>
        <span className="font-semibold text-brand-dark text-sm">Feedback category</span>
        <select
          className={`${inputVariants({ surface: "staff" })} bg-white`}
          disabled={saving}
          id={`${id}-category`}
          onChange={setCategory}
          value={draft.category}
        >
          {POST_TOUR_FEEDBACK_CATEGORIES.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1" htmlFor={`${id}-comment`}>
        <span className="font-semibold text-brand-dark text-sm">Comments</span>
        <Textarea
          className="bg-white"
          disabled={saving}
          id={`${id}-comment`}
          maxLength={4000}
          onChange={setComment}
          placeholder="What worked well? What would you change next time?"
          required
          rows={5}
          surface="staff"
          value={draft.comment}
        />
      </label>
      <div className="grid gap-4">
        <label className="block space-y-1" htmlFor={`${id}-vendor`}>
          <span className="font-semibold text-brand-dark text-sm">
            Hotel or restaurant, optional
          </span>
          <Input
            className="bg-white"
            disabled={saving}
            id={`${id}-vendor`}
            maxLength={160}
            onChange={setVendor}
            surface="staff"
            value={draft.vendorName}
          />
        </label>
        <label className="block space-y-1" htmlFor={`${id}-rating`}>
          <span className="font-semibold text-brand-dark text-sm">Vendor rating</span>
          <select
            className={`${inputVariants({ surface: "staff" })} bg-white`}
            disabled={saving}
            id={`${id}-rating`}
            onChange={setRating}
            value={draft.vendorRating ?? ""}
          >
            <option value="">Not applicable / not rated</option>
            {RATINGS.map((rating) => (
              <option key={rating} value={rating}>
                {rating} / 10
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-brand-muted text-xs">
        Save first to add photos. Keep passports and guest contact details out of your report.
      </p>
      {error ? (
        <p className="text-red-700 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-11 bg-[#0B1026] hover:bg-[#202843]"
          disabled={saving}
          loading={saving}
          surface="staff"
          type="submit"
          variant="primary"
        >
          {saving ? "Saving feedback..." : "Save feedback"}
        </Button>
        {onCancel ? (
          <Button
            disabled={saving}
            onClick={onCancel}
            surface="staff"
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function FeedbackCard({
  entry,
  onDelete,
  onRemovePhoto,
  onUpdate,
  onUpload,
}: {
  entry: FeedbackEntry;
  onDelete: (entry: FeedbackEntry) => Promise<void>;
  onRemovePhoto: (photoId: FeedbackEntry["photos"][number]["id"]) => Promise<void>;
  onUpdate: (entry: FeedbackEntry, draft: FeedbackDraft) => Promise<void>;
  onUpload: (entry: FeedbackEntry, file: File) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const update = async (draft: FeedbackDraft) => {
    await onUpdate(entry, draft);
    setEditing(false);
  };
  const edit = () => setEditing(true);
  const cancel = () => setEditing(false);
  const askDelete = () => setConfirmDelete(true);
  const cancelDelete = () => setConfirmDelete(false);
  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await onDelete(entry);
    } catch {
      setError("Feedback could not be deleted. Try again.");
    }
    setBusy(false);
  };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setError("");
    setStatus("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 4 * 1024 * 1024
    ) {
      setError("Choose a JPEG, PNG or WebP photo no larger than 4 MB.");
      event.target.value = "";
      return;
    }
    const input = event.target;
    setBusy(true);
    try {
      await onUpload(entry, file);
      setStatus("Photo uploaded.");
    } catch {
      setError("Photo upload failed. Your comments are saved. Choose the photo again to retry.");
    }
    setBusy(false);
    input.value = "";
  };
  const removePhoto = async (event: React.MouseEvent<HTMLButtonElement>) => {
    const photo = entry.photos.find((item) => item.id === event.currentTarget.dataset.photoId);
    if (!photo) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onRemovePhoto(photo.id);
      setStatus("Photo removed.");
    } catch {
      setError("Photo could not be removed. Try again.");
    }
    setBusy(false);
  };
  return (
    <article className="min-w-0 rounded-3xl border border-brand-border bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words font-heading font-semibold text-brand-dark text-lg">
            {categoryLabels.get(entry.category)}
          </h3>
          <p className="mt-1 break-words text-brand-muted text-xs">
            {entry.job.jobCode} · {entry.job.clientName} · {entry.job.destination}
          </p>
        </div>
        <span className="shrink-0 text-brand-muted text-xs">
          {formatDisplayDate(new Date(entry.createdAt).toISOString().slice(0, 10))}
        </span>
      </div>
      <div className="mt-4">
        {editing ? (
          <FeedbackForm initial={entry} onCancel={cancel} onSave={update} />
        ) : (
          <p className="whitespace-pre-wrap break-words text-brand-dark text-sm leading-relaxed">
            {entry.comment}
          </p>
        )}
      </div>
      {entry.vendorName || entry.vendorRating !== null ? (
        <p className="mt-3 font-medium text-brand-dark text-sm">
          {entry.vendorName || "Vendor"} ·{" "}
          {entry.vendorRating === null ? "Not rated" : `${entry.vendorRating} / 10`}
        </p>
      ) : null}
      {entry.photos.length > 0 ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 [&>li:only-child]:sm:col-span-2">
          {entry.photos.map((photo) => (
            <li className="min-w-0" key={photo.id}>
              <FeedbackPhotoPreview
                category={categoryLabels.get(entry.category) ?? "Tour photo"}
                photo={photo}
              />
              {entry.canEdit ? (
                <Button
                  className="mt-1 min-h-11"
                  data-photo-id={photo.id}
                  disabled={busy}
                  onClick={removePhoto}
                  surface="staff"
                  type="button"
                  variant="bare"
                >
                  Remove photo
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-4 text-brand-muted text-xs">
        By {entry.authorName}
        {entry.updatedAt === entry.createdAt ? "" : " · Edited"}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {entry.canEdit && !editing ? (
          <Button disabled={busy} onClick={edit} surface="staff" type="button" variant="outline">
            Edit feedback
          </Button>
        ) : null}
        {entry.canEdit && entry.photos.length < 8 ? (
          <label className="inline-flex min-h-11 max-w-full cursor-pointer items-center rounded-xl border border-brand-border px-3 text-citius-blue text-sm">
            <span>{busy ? "Uploading..." : "Add photo"}</span>
            <input
              accept="image/jpeg,image/png,image/webp"
              aria-label={`Add photo to ${categoryLabels.get(entry.category)}`}
              className="sr-only"
              disabled={busy}
              onChange={upload}
              type="file"
            />
          </label>
        ) : null}
        {entry.canDelete && !confirmDelete ? (
          <Button disabled={busy} onClick={askDelete} surface="staff" type="button" variant="bare">
            Delete feedback
          </Button>
        ) : null}
      </div>
      {entry.canEdit ? (
        <p className="mt-2 text-brand-muted text-xs">
          JPEG, PNG or WebP. Up to 4 MB each and 8 photos per feedback.
        </p>
      ) : null}
      {confirmDelete ? (
        <div className="mt-3 space-y-2 rounded-xl border border-brand-border p-3">
          <p className="text-sm">Delete this feedback and its photos? This cannot be undone.</p>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={remove} surface="staff" type="button" variant="danger">
              Delete permanently
            </Button>
            <Button
              disabled={busy}
              onClick={cancelDelete}
              surface="staff"
              type="button"
              variant="outline"
            >
              Keep feedback
            </Button>
          </div>
        </div>
      ) : null}
      <p aria-live="polite" className="mt-2 text-brand-muted text-xs" role="status">
        {status}
      </p>
      {error ? (
        <p className="mt-2 text-red-700 text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}

export function PostTourFeedbackView({
  entries,
  job,
  loading = false,
  onSave,
  ...actions
}: {
  entries: FeedbackEntry[];
  job: FeedbackJob | null;
  loading?: boolean;
  onSave: (draft: FeedbackDraft) => Promise<void>;
} & Pick<
  React.ComponentProps<typeof FeedbackCard>,
  "onDelete" | "onRemovePhoto" | "onUpdate" | "onUpload"
>) {
  const [status, setStatus] = useState("");
  const save = async (draft: FeedbackDraft) => {
    await onSave(draft);
    setStatus("Feedback saved. Add photos to your report.");
  };
  return (
    <div className="space-y-6 font-sans">
      {job ? (
        <section className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div>
            <h2 className="font-heading font-semibold text-[#0B1026] text-xl">
              {job.destination || job.clientName}
            </h2>
            <p className="mt-1 text-brand-muted text-sm">
              {job.clientName} · {job.jobCode}
            </p>
          </div>
          <p className="text-brand-muted text-sm">
            {job.travelStartDate ? formatDisplayDate(job.travelStartDate) : "Dates not recorded"}
            {job.travelEndDate ? ` to ${formatDisplayDate(job.travelEndDate)}` : ""}
          </p>
        </section>
      ) : (
        <p className="text-brand-muted text-sm">
          Choose a Job Card to read its feedback or add your report.
        </p>
      )}
      <p aria-live="polite" className="text-brand-muted text-sm empty:hidden" role="status">
        {status}
      </p>
      <div
        className={
          job?.canCompose
            ? "grid items-start gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]"
            : ""
        }
      >
        {job?.canCompose ? (
          <details
            className="min-w-0 rounded-3xl border border-[#0B1026]/10 bg-[#FDFBF7] p-5 sm:p-6"
            open
          >
            <summary className="min-h-11 cursor-pointer font-heading font-semibold text-[#0B1026] text-lg focus-visible:outline-2 focus-visible:outline-citius-blue">
              Add feedback
            </summary>
            <div className="pt-3">
              <FeedbackForm key={job.jobCardId} onSave={save} />
            </div>
          </details>
        ) : null}
        <section aria-label="Team feedback" className="min-w-0 space-y-4">
          <h2 className="font-heading font-semibold text-brand-dark text-lg">
            {job ? "Feedback for this tour" : "Latest team feedback"}
          </h2>
          {loading ? (
            <p className="text-brand-muted text-sm" role="status">
              Loading feedback...
            </p>
          ) : null}
          {!loading && entries.length === 0 ? (
            <p className="rounded-3xl border border-brand-border bg-white p-6 text-brand-muted text-sm">
              No post-tour feedback yet.
              {job?.canCompose
                ? " Add a note about this trip."
                : " Reports appear here when tour managers add them."}
            </p>
          ) : null}
          {entries.map((entry) => (
            <FeedbackCard entry={entry} key={entry.id} {...actions} />
          ))}
        </section>
      </div>
    </div>
  );
}
