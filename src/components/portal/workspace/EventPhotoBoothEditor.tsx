"use client";

import type { Id } from "@convex/_generated/dataModel";

import Image from "next/image";
import { type ChangeEvent, type FormEvent, useEffect, useId, useRef, useState } from "react";
import { usePortalConfirm } from "@/components/portal/PortalConfirmDialog";
import { Button } from "@/components/ui/application-button";
import type {
  BoothArtwork,
  BoothAvailability,
  BoothManagementState,
  BoothScene,
  BoothSceneDraft,
  BoothSceneKey,
  BoothStaffOption,
} from "@/lib/eventPhotoBooth/contracts";
import {
  BOOTH_ARTWORK_URLS,
  BOOTH_METRICS,
  BOOTH_THUMBNAIL_URLS,
  DEFAULT_BOOTH_SCENES,
} from "@/lib/eventPhotoBooth/contracts";

import { loadSourcePhoto, releaseBoothPhoto } from "@/lib/eventPhotoBooth/imageEngine";
import { EventPhotoBoothPreview } from "./EventPhotoBoothPreview";
import { formatConvexError } from "./portalWorkspaceListHelpers";

const INPUT =
  "min-h-11 w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-brand-dark text-sm focus-visible:outline-2 focus-visible:outline-citius-blue";
const PANEL = "rounded-xl border border-brand-border bg-white p-4 sm:p-6";
const METRIC_LABELS = {
  creation_completed: "Photos created",
  download_action: "Download actions",
  enquiry_entry: "Enquiry clicks",
  share_attempt: "Share attempts",
  visit: "Visits",
} as const;

export interface EventPhotoBoothEditorProps {
  loadMoreStaff: () => void;
  publishScenes: (args: { expectedRevision: number }) => Promise<number>;
  saveDraftScenes: (args: {
    expectedRevision: number;
    scenes: BoothSceneDraft[];
  }) => Promise<number>;
  setAvailability: (args: { availability: BoothAvailability }) => Promise<null>;
  setStaffAssignment: (args: { staffId: Id<"staffUsers">; assigned: boolean }) => Promise<null>;
  staff: BoothStaffOption[];
  staffStatus: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  state: BoothManagementState;
  uploadArtwork: (args: {
    bytes: ArrayBuffer;
  }) => Promise<{ artwork: BoothArtwork; artworkUrl: string }>;
}

function errorMessage(error: Error) {
  const message = formatConvexError(
    error,
    "The change could not be saved. Your edits are kept; try again."
  );
  const messages = {
    ARTWORK_TOO_LARGE: "Choose a smaller background image.",
    ARTWORK_UNAVAILABLE: "A background is unavailable. Replace it, then save and publish again.",
    CONFIG_UNAVAILABLE: "The booth settings are unavailable. Reload and try again.",
    FORBIDDEN: "Your event access has changed. Ask an Admin or Director to check it.",
    INVALID_ARTWORK: "Choose a valid JPEG, PNG or WebP background.",
    INVALID_SCENE_ID: "A scene could not be saved. Reload the latest draft and add it again.",
    INVALID_SCENE_TEXT: "Check each scene's English and Hindi names and captions before saving.",
    INVALID_SCENES: "Keep between 1 and 24 scenes in the draft.",
    INVALID_STAFF: "This staff member is unavailable. Reload the staff list and try again.",
    NO_VISIBLE_SCENES: "Show at least one scene and publish it before opening the booth.",
    REVISION_CONFLICT:
      "Another event manager changed the scenes. Your edits are kept here. Load the latest saved draft before saving again.",
  };
  return Object.entries(messages).find(([code]) => code === message)?.[1] ?? message;
}

async function prepareArtwork(file: File): Promise<ArrayBuffer> {
  const photo = await loadSourcePhoto(file);
  try {
    const blob = await new Promise<Blob | null>((resolve) =>
      photo.canvas.toBlob(resolve, "image/jpeg", 0.8)
    );
    if (blob && blob.size <= 900_000) {
      return blob.arrayBuffer();
    }
    throw new Error("This artwork is too large after resizing. Choose a smaller image.");
  } finally {
    releaseBoothPhoto(photo);
  }
}

function SceneFields({
  scene,
  update,
}: {
  scene: BoothScene;
  update: (scene: BoothScene) => void;
}) {
  const changeCategory = (event: ChangeEvent<HTMLSelectElement>) =>
    update({ ...scene, category: event.target.value === "pilgrimage" ? "pilgrimage" : "travel" });
  const changeVisibility = (event: ChangeEvent<HTMLInputElement>) =>
    update({ ...scene, visible: event.target.checked });
  const changeEnglishTitle = (event: ChangeEvent<HTMLInputElement>) =>
    update({ ...scene, title: { ...scene.title, en: event.target.value } });
  const changeHindiTitle = (event: ChangeEvent<HTMLInputElement>) =>
    update({ ...scene, title: { ...scene.title, hi: event.target.value } });
  const changeEnglishCaption = (event: ChangeEvent<HTMLInputElement>) =>
    update({ ...scene, caption: { ...scene.caption, en: event.target.value } });
  const changeHindiCaption = (event: ChangeEvent<HTMLInputElement>) =>
    update({ ...scene, caption: { ...scene.caption, hi: event.target.value } });
  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <label className="space-y-1 text-sm">
        Category
        <select
          aria-label="Category"
          className={INPUT}
          onChange={changeCategory}
          value={scene.category}
        >
          <option value="travel">Travel</option>
          <option value="pilgrimage">Pilgrimage</option>
        </select>
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          checked={scene.visible}
          className="size-5"
          onChange={changeVisibility}
          type="checkbox"
        />
        Show to visitors
      </label>
      <label className="space-y-1 text-sm">
        English destination
        <input
          className={INPUT}
          maxLength={80}
          onChange={changeEnglishTitle}
          required
          value={scene.title.en}
        />
      </label>
      <label className="space-y-1 text-sm">
        Hindi destination
        <input
          className={INPUT}
          lang="hi"
          maxLength={80}
          onChange={changeHindiTitle}
          required
          value={scene.title.hi}
        />
      </label>
      <label className="space-y-1 text-sm">
        English caption
        <input
          className={INPUT}
          maxLength={160}
          onChange={changeEnglishCaption}
          value={scene.caption.en}
        />
      </label>
      <label className="space-y-1 text-sm">
        Hindi caption
        <input
          className={INPUT}
          lang="hi"
          maxLength={160}
          onChange={changeHindiCaption}
          value={scene.caption.hi}
        />
      </label>
    </div>
  );
}

const THUMBNAIL_SIZES = "160px";

/**
 * A 160px card. Bundled scenes use their precomputed 192px/384px WebP pair, so
 * the card stays sharp on 2x screens; uploaded artwork goes through the image
 * optimizer at card size instead of downloading the full-size original.
 */
function BackgroundThumbnail({
  bundled,
  label,
  src,
}: {
  bundled: BoothSceneKey | null;
  label: string;
  src: string;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <p
      className="flex h-28 w-40 items-center rounded-lg border border-brand-border p-3 text-brand-muted text-sm"
      role="status"
    >
      Background unavailable
    </p>
  ) : (
    <picture>
      {bundled ? (
        <source
          sizes={THUMBNAIL_SIZES}
          srcSet={`${BOOTH_THUMBNAIL_URLS[bundled].small} 192w, ${BOOTH_THUMBNAIL_URLS[bundled].large} 384w`}
          type="image/webp"
        />
      ) : null}
      <Image
        alt={label}
        className="h-28 w-40 rounded-lg border border-brand-border bg-brand-light object-cover"
        height={112}
        loading="eager"
        onError={() => setFailed(true)}
        quality={90}
        sizes={THUMBNAIL_SIZES}
        src={bundled ? BOOTH_THUMBNAIL_URLS[bundled].large : src}
        unoptimized={Boolean(bundled)}
        width={160}
      />
    </picture>
  );
}

function TemplateChooser({
  adding,
  apply,
  cancel,
}: {
  adding: boolean;
  apply: (preset: BoothSceneDraft) => void;
  cancel: () => void;
}) {
  const [templateId, setTemplateId] = useState("");
  const select = useRef<HTMLSelectElement>(null);
  const confirmed = useRef(false);
  const preset = DEFAULT_BOOTH_SCENES.find((scene) => scene.id === templateId);
  useEffect(() => select.current?.focus(), []);
  const confirm = () => {
    if (preset && !confirmed.current) {
      confirmed.current = true;
      apply(preset);
    }
  };
  return (
    <div className="space-y-3 rounded-lg border border-brand-border bg-brand-light p-4">
      <label className="block space-y-1 text-sm">
        Destination template
        <select
          aria-label="Destination template"
          className={INPUT}
          onChange={(event) => setTemplateId(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
          ref={select}
          value={templateId}
        >
          <option disabled value="">
            Choose a template…
          </option>
          {DEFAULT_BOOTH_SCENES.map((scene) => (
            <option key={scene.id} value={scene.id}>
              {scene.title.en}
            </option>
          ))}
        </select>
      </label>
      {preset?.artwork.kind === "bundled" ? (
        <div className="flex flex-wrap items-center gap-3">
          <BackgroundThumbnail
            bundled={preset.artwork.key}
            key={preset.id}
            label={`${preset.title.en} template preview`}
            src={BOOTH_THUMBNAIL_URLS[preset.artwork.key].large}
          />
          <div className="text-sm">
            <p>
              {preset.title.en} · <span lang="hi">{preset.title.hi}</span>
            </p>
            <p className="mt-1 text-brand-muted">
              {preset.category === "travel" ? "Travel" : "Pilgrimage"}
            </p>
          </div>
        </div>
      ) : null}
      {adding ? null : (
        <p className="text-brand-muted text-xs">
          Replaces the background and default text. Keeps your custom text.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-11"
          disabled={!preset}
          onClick={confirm}
          type="button"
          variant="primary"
        >
          {adding ? "Add selected destination" : "Apply template"}
        </Button>
        <Button
          aria-label={adding ? "Cancel adding destination" : "Cancel template change"}
          className="min-h-11"
          onClick={cancel}
          type="button"
          variant="bare"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

interface NewDestination {
  category: BoothScene["category"];
  file: File;
  title: BoothScene["title"];
}

function NewDestinationForm({
  create,
  cancel,
}: {
  create: (destination: NewDestination) => Promise<string | null>;
  cancel: () => void;
}) {
  const english = useRef<HTMLInputElement>(null);
  const hindi = useRef<HTMLInputElement>(null);
  const background = useRef<HTMLInputElement>(null);
  const category = useRef<HTMLSelectElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const confirming = useRef(false);
  const [error, setError] = useState("");
  const [hasEdits, setHasEdits] = useState(false);
  useEffect(() => english.current?.focus(), []);
  useEffect(() => {
    if (error) {
      confirmButton.current?.focus();
    }
  }, [error]);
  useEffect(() => {
    if (!hasEdits) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasEdits]);
  const change = () => {
    english.current?.setCustomValidity("");
    hindi.current?.setCustomValidity("");
    setHasEdits(
      Boolean(
        english.current?.value ||
          hindi.current?.value ||
          background.current?.files?.length ||
          category.current?.value === "pilgrimage"
      )
    );
  };
  const confirm = async () => {
    const en = english.current;
    const hi = hindi.current;
    const image = background.current;
    if (confirming.current || !en || !hi || !image) {
      return;
    }
    en.setCustomValidity(en.value.trim() ? "" : "Enter the English destination name.");
    hi.setCustomValidity(hi.value.trim() ? "" : "Enter the Hindi destination name.");
    if (!(en.reportValidity() && hi.reportValidity() && image.reportValidity())) {
      return;
    }
    const file = image.files?.[0];
    if (!file) {
      return;
    }
    confirming.current = true;
    setError("");
    const failure = await create({
      category: category.current?.value === "pilgrimage" ? "pilgrimage" : "travel",
      file,
      title: { en: en.value.trim(), hi: hi.value.trim() },
    });
    confirming.current = false;
    if (failure) {
      setError(failure);
    }
  };
  return (
    <fieldset
      className="space-y-3 rounded-lg border border-brand-border bg-brand-light p-4"
      onChange={change}
    >
      <legend className="sr-only">Create a new destination</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          English destination
          <input className={INPUT} maxLength={80} ref={english} required />
        </label>
        <label className="space-y-1 text-sm">
          Hindi destination
          <input className={INPUT} lang="hi" maxLength={80} ref={hindi} required />
        </label>
      </div>
      <label className="block space-y-1 text-sm">
        Category
        <select aria-label="Category" className={INPUT} defaultValue="travel" ref={category}>
          <option value="travel">Travel</option>
          <option value="pilgrimage">Pilgrimage</option>
        </select>
      </label>
      <label className="block space-y-1 text-sm">
        Destination background
        <input
          accept="image/jpeg,image/png,image/webp"
          aria-label="Destination background"
          className={`${INPUT} block file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-white file:px-3`}
          ref={background}
          required
          type="file"
        />
        <span className="block text-brand-muted text-xs">
          JPEG, PNG or WebP, up to 12 MB. Scenery only.
        </span>
      </label>
      {error ? (
        <p className="text-red-800 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-11"
          onClick={confirm}
          ref={confirmButton}
          type="button"
          variant="primary"
        >
          Add new destination
        </Button>
        <Button
          aria-label="Cancel adding destination"
          className="min-h-11"
          onClick={cancel}
          type="button"
          variant="bare"
        >
          Cancel
        </Button>
      </div>
    </fieldset>
  );
}

function AddDestinationChooser({
  apply,
  create,
  cancel,
}: {
  apply: (preset: BoothSceneDraft) => void;
  create: (destination: NewDestination) => Promise<string | null>;
  cancel: () => void;
}) {
  const [mode, setMode] = useState<"template" | "custom" | null>(null);
  const firstChoice = useRef<HTMLButtonElement>(null);
  useEffect(() => firstChoice.current?.focus(), []);
  return (
    <div className="space-y-3">
      {mode ? null : (
        <div className="flex flex-wrap gap-2">
          <Button
            className="min-h-11"
            onClick={() => setMode("template")}
            ref={firstChoice}
            type="button"
            variant="outline"
          >
            Use a template
          </Button>
          <Button
            className="min-h-11"
            onClick={() => setMode("custom")}
            type="button"
            variant="outline"
          >
            Create a new destination
          </Button>
        </div>
      )}
      {mode === "template" ? <TemplateChooser adding apply={apply} cancel={cancel} /> : null}
      {mode === "custom" ? <NewDestinationForm cancel={cancel} create={create} /> : null}
      {mode ? null : (
        <Button
          aria-label="Cancel adding destination"
          className="min-h-11"
          onClick={cancel}
          type="button"
          variant="bare"
        >
          Cancel
        </Button>
      )}
    </div>
  );
}

function SceneNavigation({
  disabled,
  index,
  next,
  previous,
  total,
}: {
  disabled: boolean;
  index: number;
  next: () => void;
  previous: () => void;
  total: number;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        aria-label="Previous scene"
        className="min-h-11 px-2!"
        disabled={index <= 0 || disabled}
        onClick={previous}
        type="button"
        variant="outline"
      >
        Previous
      </Button>
      <span
        aria-live="polite"
        className="whitespace-nowrap px-1 text-brand-muted text-sm tabular-nums"
      >
        <span className="sr-only">Scene </span>
        {index + 1} of {total}
      </span>
      <Button
        aria-label="Next scene"
        className="min-h-11 px-2!"
        disabled={index < 0 || index >= total - 1 || disabled}
        onClick={next}
        type="button"
        variant="outline"
      >
        Next
      </Button>
    </div>
  );
}

function StaffAssignment({
  person,
  busy,
  change,
}: {
  person: BoothStaffOption;
  busy: boolean;
  change: (person: BoothStaffOption) => void;
}) {
  const toggle = () => change(person);
  const privileged = hasAutomaticAccess(person);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-brand-border border-t py-3">
      <div className="min-w-0">
        <p className="break-words font-medium">{person.name}</p>
        <p className="text-brand-muted text-sm">
          {person.roles.join(", ")}
          {person.active ? "" : " · Inactive"}
        </p>
      </div>
      {privileged ? (
        <span className="text-brand-muted text-sm">Automatic access</span>
      ) : (
        <Button
          aria-label={
            person.assigned ? `Remove access for ${person.name}` : `Give access to ${person.name}`
          }
          className="min-h-11"
          disabled={busy || !(person.active || person.assigned)}
          onClick={toggle}
          type="button"
          variant="outline"
        >
          {person.assigned ? "Remove access" : "Give access"}
        </Button>
      )}
    </li>
  );
}

const SEARCH_RESULT_LIMIT = 8;

function hasAutomaticAccess(person: BoothStaffOption) {
  return person.roles.some((role) => role === "Admin" || role === "Directors");
}

function matchesStaffSearch(person: BoothStaffOption, term: string) {
  return `${person.name} ${person.roles.join(" ")}`.toLowerCase().includes(term);
}

function StaffSearch({
  busy,
  change,
  candidates,
  props,
}: {
  busy: boolean;
  change: (person: BoothStaffOption) => void;
  candidates: BoothStaffOption[];
  props: EventPhotoBoothEditorProps;
}) {
  const searchId = useId();
  const resultsId = useId();
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const matches = term ? candidates.filter((person) => matchesStaffSearch(person, term)) : [];
  const shown = matches.slice(0, SEARCH_RESULT_LIMIT);
  const { staffStatus } = props;
  const canLoadMore = staffStatus === "CanLoadMore" || staffStatus === "LoadingMore";
  let summary = "Type a name or role to find someone.";
  if (term && matches.length === 0) {
    summary = canLoadMore
      ? "No match among the staff loaded so far. Load more staff to search everyone."
      : "No matching staff.";
  } else if (matches.length > shown.length) {
    summary = `Showing ${shown.length} of ${matches.length} matches. Keep typing to narrow the list.`;
  } else if (term) {
    summary = "";
  }
  return (
    <div className="mt-6 border-brand-border border-t pt-5">
      <label className="block font-semibold text-sm" htmlFor={searchId}>
        Give someone access
      </label>
      <input
        aria-controls={resultsId}
        aria-describedby={`${resultsId}-summary`}
        autoComplete="off"
        className={`${INPUT} mt-2 max-w-md`}
        id={searchId}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name or role"
        type="search"
        value={query}
      />
      <p
        aria-live="polite"
        className="mt-2 text-brand-muted text-sm empty:hidden"
        id={`${resultsId}-summary`}
      >
        {summary}
      </p>
      <ul className="mt-2" id={resultsId}>
        {shown.map((person) => (
          <StaffAssignment busy={busy} change={change} key={person.id} person={person} />
        ))}
      </ul>
      {canLoadMore ? (
        <Button
          className="mt-3 min-h-11"
          disabled={staffStatus === "LoadingMore"}
          onClick={props.loadMoreStaff}
          type="button"
          variant="outline"
        >
          {staffStatus === "LoadingMore" ? "Loading staff…" : "Load more staff"}
        </Button>
      ) : null}
    </div>
  );
}

function StaffAssignments({
  busy,
  change,
  props,
}: {
  busy: boolean;
  change: (person: BoothStaffOption) => void;
  props: EventPhotoBoothEditorProps;
}) {
  const { staff, staffStatus } = props;
  if (!props.state.canManageAssignments) {
    return null;
  }
  const assigned: BoothStaffOption[] = [];
  const candidates: BoothStaffOption[] = [];
  for (const person of staff) {
    (person.assigned && !hasAutomaticAccess(person) ? assigned : candidates).push(person);
  }
  return (
    <section className={PANEL}>
      <h2 className="font-semibold text-lg">Event staff access</h2>
      <p className="mt-1 text-brand-muted text-sm">
        Assigned staff can edit and publish scenes, and open or close the booth. Admins and
        Directors always have access.
      </p>
      {staffStatus === "LoadingFirstPage" ? (
        <p className="mt-3" role="status">
          Loading staff…
        </p>
      ) : (
        <>
          <h3 className="mt-5 flex items-baseline gap-2 font-semibold text-base">
            Has access
            <span aria-hidden="true" className="font-normal text-brand-muted text-sm tabular-nums">
              {assigned.length}
            </span>
            <span className="sr-only">, {assigned.length} assigned</span>
          </h3>
          {assigned.length > 0 ? (
            <ul className="mt-2">
              {assigned.map((person) => (
                <StaffAssignment busy={busy} change={change} key={person.id} person={person} />
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-brand-muted text-sm">
              {staff.length === 0 ? "No staff records available." : "No one is assigned yet."}
            </p>
          )}
          <StaffSearch busy={busy} candidates={candidates} change={change} props={props} />
        </>
      )}
    </section>
  );
}

function useBoothEditor(props: EventPhotoBoothEditorProps) {
  const { state } = props;
  const [draft, setDraft] = useState({
    dirty: false,
    revision: state.revision,
    scenes: state.draftScenes,
  });
  const [selectedId, setSelectedId] = useState(state.draftScenes[0]?.id ?? "");
  const [busy, setBusy] = useState<false | "saving" | "uploading">(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  if (state.revision > draft.revision && !draft.dirty && !busy) {
    setDraft({ dirty: false, revision: state.revision, scenes: state.draftScenes });
  }
  const selected = draft.scenes.find((scene) => scene.id === selectedId) ?? draft.scenes[0];
  const index = selected ? draft.scenes.indexOf(selected) : -1;
  const conflict = state.revision > draft.revision;
  let statusMessage = busy ? "Saving change…" : message;
  if (busy === "uploading") {
    statusMessage = "Uploading background…";
  }
  const unpublished =
    JSON.stringify(draft.scenes.map(({ artworkUrl: _url, ...scene }) => scene)) !==
    JSON.stringify(state.publishedScenes.map(({ artworkUrl: _url, ...scene }) => scene));

  let draftStatus = unpublished ? "Saved draft · not published" : "Published";
  if (draft.dirty) {
    draftStatus = "Unsaved changes";
  }

  useEffect(() => {
    if (!draft.dirty) {
      return;
    }
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [draft.dirty]);

  const beginChange = (operation: "saving" | "uploading" = "saving") => {
    setBusy(operation);
    setError("");
    setMessage("");
  };
  const reportFailure = (failure: Error) => setError(errorMessage(failure));
  const update = (scene: BoothScene) =>
    setDraft((previous) => ({
      ...previous,
      dirty: true,
      scenes: previous.scenes.map((item) => (item.id === scene.id ? scene : item)),
    }));
  const selectScene = (event: ChangeEvent<HTMLSelectElement>) => setSelectedId(event.target.value);
  const addScene = (content: Omit<BoothScene, "id">) => {
    if (draft.scenes.length >= 24) {
      return false;
    }
    const scene: BoothScene = {
      ...content,
      id: `scene-${crypto.randomUUID().slice(0, 8)}`,
    };
    setDraft((previous) =>
      previous.scenes.length >= 24
        ? previous
        : { ...previous, dirty: true, scenes: [...previous.scenes, scene] }
    );
    setSelectedId(scene.id);
    setMessage(`${scene.title.en} added to the draft.`);
    return true;
  };
  const createDestination = async ({ title, category, file }: NewDestination) => {
    if (busy || draft.scenes.length >= 24) {
      return "The draft already has 24 scenes.";
    }
    if (!(title.en.trim() && title.hi.trim())) {
      return "Enter both destination names.";
    }
    beginChange("uploading");
    let failureMessage: string | null = null;
    try {
      const result = await props.uploadArtwork({ bytes: await prepareArtwork(file) });
      if (!addScene({ ...result, caption: { en: "", hi: "" }, category, title, visible: true })) {
        failureMessage = "The draft already has 24 scenes.";
      }
    } catch (failure) {
      failureMessage = errorMessage(
        failure instanceof Error ? failure : new Error("Background upload failed. Try again.")
      );
    }
    setBusy(false);
    return failureMessage;
  };
  const applyTemplate = (preset: BoothSceneDraft) => {
    if (!selected || preset.artwork.kind !== "bundled") {
      return;
    }
    const text = (field: "title" | "caption", language: "en" | "hi") =>
      !selected[field][language].trim() ||
      DEFAULT_BOOTH_SCENES.some(
        (candidate) => candidate[field][language] === selected[field][language]
      )
        ? preset[field][language]
        : selected[field][language];
    update({
      ...selected,
      artwork: preset.artwork,
      artworkUrl: BOOTH_ARTWORK_URLS[preset.artwork.key],
      caption: { en: text("caption", "en"), hi: text("caption", "hi") },
      category: preset.category,
      title: { en: text("title", "en"), hi: text("title", "hi") },
    });
    setMessage(`${preset.title.en} template applied to this draft.`);
  };
  const previousScene = () => {
    if (index > 0) {
      setSelectedId(draft.scenes[index - 1].id);
    }
  };
  const nextScene = () => {
    if (index >= 0 && index < draft.scenes.length - 1) {
      setSelectedId(draft.scenes[index + 1].id);
    }
  };
  const moveScene = (event: ChangeEvent<HTMLSelectElement>) => {
    const position = Number(event.target.value);
    if (
      !(selected && Number.isInteger(position)) ||
      position < 0 ||
      position >= draft.scenes.length ||
      position === index
    ) {
      return;
    }
    const scenes = draft.scenes.filter((scene) => scene.id !== selected.id);
    scenes.splice(position, 0, selected);
    setSelectedId(selected.id);
    setDraft((previous) => ({ ...previous, dirty: true, scenes }));
  };
  const loadLatest = () => {
    setDraft({ dirty: false, revision: state.revision, scenes: state.draftScenes });
    setError("");
    setMessage("Latest saved draft loaded.");
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const invalidScene = draft.scenes.find(
      (scene) => !(scene.title.en.trim() && scene.title.hi.trim())
    );
    if (invalidScene) {
      setSelectedId(invalidScene.id);
      setError("Every scene needs an English and Hindi destination name.");
      return;
    }
    beginChange();
    try {
      const revision = await props.saveDraftScenes({
        expectedRevision: draft.revision,
        scenes: draft.scenes.map(({ artworkUrl: _url, ...scene }) => scene),
      });
      setDraft({ ...draft, dirty: false, revision });
      setMessage("Draft saved. Publish to update the visitor page.");
    } catch (failure) {
      reportFailure(
        failure instanceof Error
          ? failure
          : new Error("The draft could not be saved. Your edits are kept; try again.")
      );
    }
    setBusy(false);
  };
  const publish = async () => {
    beginChange();
    try {
      const revision = await props.publishScenes({ expectedRevision: draft.revision });
      setDraft({ ...draft, dirty: false, revision });
      setMessage("Scenes published for visitors.");
    } catch (failure) {
      reportFailure(
        failure instanceof Error ? failure : new Error("Publishing failed. Try again.")
      );
    }
    setBusy(false);
  };
  const toggleAvailability = async () => {
    beginChange();
    try {
      const availability = state.availability === "open" ? "closed" : "open";
      await props.setAvailability({ availability });
      setMessage(
        availability === "open"
          ? "The event is open to anyone with its link."
          : "The event is closed to visitors."
      );
    } catch (failure) {
      reportFailure(
        failure instanceof Error
          ? failure
          : new Error("Availability could not be changed. Try again.")
      );
    }
    setBusy(false);
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!(file && selected)) {
      return;
    }
    beginChange("uploading");
    try {
      const result = await props.uploadArtwork({ bytes: await prepareArtwork(file) });
      update({ ...selected, ...result });
      setMessage("Background uploaded. Save and publish to show it to visitors.");
    } catch (failure) {
      reportFailure(
        failure instanceof Error ? failure : new Error("Artwork could not be uploaded. Try again.")
      );
    }
    setBusy(false);
  };
  const assign = async (person: BoothStaffOption) => {
    beginChange();
    try {
      await props.setStaffAssignment({ assigned: !person.assigned, staffId: person.id });
      setMessage(
        person.assigned
          ? `Event access removed for ${person.name}.`
          : `Event access assigned to ${person.name}.`
      );
    } catch (failure) {
      reportFailure(
        failure instanceof Error
          ? failure
          : new Error("Staff access could not be changed. Try again.")
      );
    }
    setBusy(false);
  };

  return {
    addScene,
    applyTemplate,
    assign,
    busy: Boolean(busy),
    conflict,
    createDestination,
    draft,
    draftStatus,
    error,
    index,
    loadLatest,
    moveScene,
    nextScene,
    previousScene,
    publish,
    save,
    selected,
    selectScene,
    statusMessage,
    toggleAvailability,
    unpublished,
    update,
    upload,
  };
}

function publishHintFor({
  conflict,
  dirty,
  unpublished,
}: {
  conflict: boolean;
  dirty: boolean;
  unpublished: boolean;
}) {
  if (dirty) {
    return "Save your draft first; publishing shows it to guests.";
  }
  return unpublished && !conflict ? "Publishing shows the saved draft to guests." : "";
}

function SceneEditor({ editor }: { editor: ReturnType<typeof useBoothEditor> }) {
  const {
    draft,
    selected,
    index,
    conflict,
    unpublished,
    draftStatus,
    busy,
    update,
    selectScene,
    addScene,
    applyTemplate,
    createDestination,
    moveScene,
    previousScene,
    nextScene,
    loadLatest,
    save,
    publish,
    upload,
  } = editor;

  const [templateAction, setTemplateAction] = useState<"add" | "replace" | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const sceneSelect = useRef<HTMLSelectElement>(null);
  const templateButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<"add" | "scene" | "template" | null>(null);
  useEffect(() => {
    if (templateAction !== null) {
      return;
    }
    const targets = {
      add: addButton.current,
      scene: sceneSelect.current,
      template: templateButton.current,
    };
    const target = returnFocus.current ? targets[returnFocus.current] : null;
    (target?.disabled ? sceneSelect.current : target)?.focus();
    returnFocus.current = null;
  }, [templateAction]);
  const closeTemplates = () => {
    returnFocus.current = templateAction === "add" ? "add" : "template";
    setTemplateAction(null);
  };
  const confirmTemplate = (preset: BoothSceneDraft) => {
    if (templateAction === "add" && preset.artwork.kind === "bundled") {
      addScene({ ...preset, artworkUrl: BOOTH_ARTWORK_URLS[preset.artwork.key] });
    } else {
      applyTemplate(preset);
    }
    returnFocus.current = templateAction === "add" ? "scene" : "template";
    setTemplateAction(null);
  };
  const confirmNewDestination = async (destination: NewDestination) => {
    const failure = await createDestination(destination);
    if (!failure) {
      returnFocus.current = "scene";
      setTemplateAction(null);
    }
    return failure;
  };
  const editingScene = selected && templateAction !== "add";
  const publishHintId = useId();
  const publishHint = publishHintFor({ conflict, dirty: draft.dirty, unpublished });

  return (
    <form
      className={PANEL}
      onSubmit={(event) => {
        if (templateAction) {
          event.preventDefault();
        } else {
          save(event);
        }
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-lg">Destination scenes</h2>
        <span className="text-brand-muted text-sm">{draftStatus}</span>
      </div>
      {conflict ? (
        <p className="mt-3 text-amber-800 text-sm" role="alert">
          A newer draft is available. Your unsaved edits are still here.
        </p>
      ) : null}
      <fieldset className="mt-4 min-w-0 space-y-4" disabled={busy}>
        <legend className="sr-only">Edit destination scene</legend>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 basis-56 space-y-1 text-sm">
            Edit scene
            <select
              aria-label="Edit scene"
              className={INPUT}
              disabled={templateAction === "add"}
              onChange={(event) => {
                setTemplateAction(null);
                selectScene(event);
              }}
              ref={sceneSelect}
              value={selected?.id ?? ""}
            >
              {draft.scenes.map((scene, position) => (
                <option key={scene.id} value={scene.id}>
                  {position + 1}. {scene.title.en || "New scene"}
                  {scene.visible ? "" : " (hidden)"}
                </option>
              ))}
            </select>
          </label>
          <Button
            aria-expanded={templateAction === "add"}
            className="min-h-11"
            disabled={draft.scenes.length >= 24}
            onClick={() => setTemplateAction("add")}
            ref={addButton}
            type="button"
            variant="outline"
          >
            Add destination
          </Button>
        </div>
        {draft.scenes.length >= 24 ? (
          <p className="text-brand-muted text-sm">24-scene limit reached.</p>
        ) : null}
        <SceneNavigation
          disabled={templateAction === "add"}
          index={index}
          next={() => {
            setTemplateAction(null);
            nextScene();
          }}
          previous={() => {
            setTemplateAction(null);
            previousScene();
          }}
          total={draft.scenes.length}
        />
        {templateAction === "add" ? (
          <AddDestinationChooser
            apply={confirmTemplate}
            cancel={closeTemplates}
            create={confirmNewDestination}
          />
        ) : null}
        {editingScene ? (
          <>
            <div className="flex flex-col items-start gap-4 border-brand-border border-t pt-4 sm:flex-row">
              <figure className="space-y-2">
                <BackgroundThumbnail
                  bundled={selected.artwork.kind === "bundled" ? selected.artwork.key : null}
                  key={`${selected.id}:${selected.artworkUrl}`}
                  label={`Current background for ${selected.title.en}`}
                  src={selected.artworkUrl}
                />
                <figcaption className="text-brand-muted text-sm">Current background</figcaption>
              </figure>
              <div className="w-full min-w-0 flex-1 space-y-3">
                <Button
                  aria-expanded={templateAction === "replace"}
                  className="min-h-11"
                  onClick={() => setTemplateAction("replace")}
                  ref={templateButton}
                  type="button"
                  variant="outline"
                >
                  Choose destination template
                </Button>
                <label className="block space-y-1 text-sm">
                  Upload replacement background
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Upload replacement background"
                    className={`${INPUT} block file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-brand-light file:px-3`}
                    onChange={upload}
                    type="file"
                  />
                  <span className="block text-brand-muted text-xs">
                    JPEG, PNG or WebP, up to 12 MB. Keeps destination names. Scenery only.
                  </span>
                </label>
              </div>
            </div>
            {templateAction === "replace" ? (
              <TemplateChooser
                adding={false}
                apply={confirmTemplate}
                cancel={closeTemplates}
                key={`replace-${selected.id}-${draft.revision}`}
              />
            ) : null}
            <SceneFields scene={selected} update={update} />
            <label className="block max-w-xs space-y-1 text-sm">
              Display order
              <select
                aria-label="Display order"
                className={INPUT}
                onChange={moveScene}
                value={index}
              >
                {draft.scenes.map((scene, position) => (
                  <option key={scene.id} value={position}>
                    {position + 1} of {draft.scenes.length}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
      </fieldset>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          className="min-h-11"
          disabled={busy || !draft.dirty || conflict || templateAction !== null}
          type="submit"
          variant="primary"
        >
          Save draft
        </Button>
        <Button
          aria-describedby={publishHint ? publishHintId : undefined}
          className="min-h-11"
          disabled={busy || draft.dirty || conflict || !unpublished || templateAction !== null}
          onClick={publish}
          type="button"
          variant="outline"
        >
          Publish scenes
        </Button>
        {draft.dirty || conflict ? (
          <Button
            className="min-h-11"
            disabled={busy || templateAction === "add"}
            onClick={() => {
              setTemplateAction(null);
              loadLatest();
            }}
            type="button"
            variant="bare"
          >
            Discard edits and reload
          </Button>
        ) : null}
      </div>
      {publishHint ? (
        <p className="mt-2 text-brand-muted text-sm" id={publishHintId}>
          {publishHint}
        </p>
      ) : null}
      {editingScene ? <EventPhotoBoothPreview scene={selected} /> : null}
    </form>
  );
}

const AVAILABILITY_CONFIRMATIONS = {
  closed: {
    confirmLabel: "Close booth",
    message: "Guests with the booth link will see that it is closed and can't create new photos.",
    title: "Close the booth?",
  },
  open: {
    confirmLabel: "Open booth",
    message: "Anyone with the booth link can create photos until you close it.",
    title: "Open the booth?",
  },
} as const;

function BoothStatus({
  busy,
  requestToggle,
  state,
}: {
  busy: boolean;
  requestToggle: () => void;
  state: BoothManagementState;
}) {
  const open = state.availability === "open";
  return (
    <section aria-labelledby="event-photo-booth-heading" className={PANEL}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold text-xl" id="event-photo-booth-heading">
            Event Photo Booth
          </h2>
          <span
            className={`rounded-full px-3 py-1 font-medium text-sm ${open ? "bg-emerald-50 text-emerald-800" : "bg-brand-light text-brand-dark"}`}
          >
            {open ? "Open" : "Closed"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            className="flex min-h-11 items-center rounded-lg px-3 font-medium text-citius-blue text-sm underline underline-offset-4"
            href="/photo-booth"
            rel="noopener"
            target="_blank"
          >
            View booth<span className="sr-only"> in a new tab</span>
          </a>
          <Button
            className="min-h-11"
            disabled={busy}
            onClick={requestToggle}
            type="button"
            variant="outline"
          >
            {open ? "Close booth" : "Open booth"}
          </Button>
        </div>
      </div>
      {open ? null : (
        <p className="mt-2 text-brand-muted text-sm">
          Admins and Directors can try the booth while closed.
        </p>
      )}
      <div className="mt-5 border-brand-border border-t pt-5">
        <h3 className="font-semibold text-base">Event totals</h3>
        <p className="mt-1 text-brand-muted text-sm">
          Action counts, not unique visitors or confirmed saves and shares.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {BOOTH_METRICS.map((key) => (
            <div key={key}>
              <dt className="text-brand-muted text-sm">{METRIC_LABELS[key]}</dt>
              <dd className="mt-1 font-semibold text-2xl tabular-nums">
                {state.metrics[key].toLocaleString("en-IN")}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function EventPhotoBoothEditor(props: EventPhotoBoothEditorProps) {
  const { state } = props;
  const editor = useBoothEditor(props);
  const { busy, error, statusMessage, toggleAvailability, assign } = editor;
  const { confirm } = usePortalConfirm();
  const requestToggle = async () => {
    const next = state.availability === "open" ? "closed" : "open";
    const confirmed = await confirm(AVAILABILITY_CONFIRMATIONS[next]);
    if (confirmed) {
      await toggleAvailability();
    }
  };

  return (
    <div className="space-y-5 text-brand-dark">
      <BoothStatus busy={busy} requestToggle={requestToggle} state={state} />
      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <p aria-atomic="true" className="text-brand-muted text-sm" role="status">
        {statusMessage}
      </p>
      <SceneEditor editor={editor} />
      <StaffAssignments busy={busy} change={assign} props={props} />
    </div>
  );
}
