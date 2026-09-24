"use client";

import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/application-button";
import type {
  BoothArtwork,
  BoothAvailability,
  BoothManagementState,
  BoothScene,
  BoothSceneDraft,
  BoothStaffOption,
} from "@/lib/eventPhotoBooth/contracts";
import { BOOTH_METRICS, BOOTH_SCENE_KEYS } from "@/lib/eventPhotoBooth/contracts";

import { loadSourcePhoto, releaseBoothPhoto } from "@/lib/eventPhotoBooth/imageEngine";
import { EventPhotoBoothPreview } from "./EventPhotoBoothPreview";

const INPUT =
  "min-h-11 w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-brand-dark text-sm focus-visible:outline-2 focus-visible:outline-citius-blue";
const PANEL = "rounded-xl border border-brand-border bg-white p-4 sm:p-6";
const METRIC_LABELS = {
  creation_completed: "Photos created",
  download_action: "Download actions",
  enquiry_entry: "Enquiry entries",
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
  setStaffAssignment: (args: { staffId: string; assigned: boolean }) => Promise<null>;
  staff: BoothStaffOption[];
  staffStatus: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  state: BoothManagementState;
  uploadArtwork: (args: {
    bytes: ArrayBuffer;
  }) => Promise<{ artwork: BoothArtwork; artworkUrl: string }>;
}

function errorMessage(error: Error) {
  if (error instanceof Error && error.message.includes("REVISION_CONFLICT")) {
    return "Another event manager changed the scenes. Your edits are kept here. Load the latest saved draft before saving again.";
  }
  return error instanceof Error
    ? error.message
    : "The change could not be saved. Your edits are kept; try again.";
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
  const changeBundledArtwork = (event: ChangeEvent<HTMLSelectElement>) => {
    const key = BOOTH_SCENE_KEYS.find((candidate) => candidate === event.target.value);
    if (key) {
      update({
        ...scene,
        artwork: { key, kind: "bundled" },
        artworkUrl: `/images/event-photo-booth/${key}.webp`,
      });
    }
  };
  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <label className="space-y-1 text-sm">
        Category
        <select className={INPUT} onChange={changeCategory} value={scene.category}>
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
        Visible to visitors after publishing
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
      <label className="space-y-1 text-sm sm:col-span-2">
        Artwork
        <select
          className={INPUT}
          onChange={changeBundledArtwork}
          value={scene.artwork.kind === "bundled" ? scene.artwork.key : "uploaded"}
        >
          {scene.artwork.kind === "upload" ? (
            <option value="uploaded">Uploaded artwork</option>
          ) : null}
          {BOOTH_SCENE_KEYS.map((key) => (
            <option key={key} value={key}>
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </option>
          ))}
        </select>
      </label>
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
  const privileged = person.roles.some((role) => role === "Admin" || role === "Directors");
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
        <span className="text-brand-muted text-sm">Access through role</span>
      ) : (
        <Button
          className="min-h-11"
          disabled={busy || !(person.active || person.assigned)}
          onClick={toggle}
          type="button"
          variant="outline"
        >
          {person.assigned ? `Remove access for ${person.name}` : `Assign ${person.name}`}
        </Button>
      )}
    </li>
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
  return (
    <>
      {props.state.canManageAssignments ? (
        <section className={PANEL}>
          <h2 className="font-semibold text-lg">Event staff access</h2>
          <p className="mt-1 text-brand-muted text-sm">
            Assigned staff can manage and publish this event. Only Admins and Directors can change
            these assignments.
          </p>
          {staffStatus === "LoadingFirstPage" ? (
            <p className="mt-3" role="status">
              Loading staff…
            </p>
          ) : (
            <ul className="mt-4">
              {staff.map((person) => (
                <StaffAssignment busy={busy} change={change} key={person.id} person={person} />
              ))}
            </ul>
          )}
          {staffStatus !== "LoadingFirstPage" && staff.length === 0 ? (
            <p className="mt-3 text-brand-muted text-sm">No staff records available.</p>
          ) : null}
          {staffStatus === "CanLoadMore" || staffStatus === "LoadingMore" ? (
            <Button
              className="min-h-11"
              disabled={staffStatus === "LoadingMore"}
              onClick={props.loadMoreStaff}
              type="button"
              variant="outline"
            >
              {staffStatus === "LoadingMore" ? "Loading staff…" : "Load more staff"}
            </Button>
          ) : null}
        </section>
      ) : null}
    </>
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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  if (state.revision > draft.revision && !draft.dirty) {
    setDraft({ dirty: false, revision: state.revision, scenes: state.draftScenes });
  }
  const selected = draft.scenes.find((scene) => scene.id === selectedId) ?? draft.scenes[0];
  const index = selected ? draft.scenes.indexOf(selected) : -1;
  const conflict = state.revision > draft.revision;
  const statusMessage = busy ? "Saving change…" : message;
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

  const beginChange = () => {
    setBusy(true);
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
  const addScene = () => {
    const scene: BoothScene = {
      artwork: { key: "paris", kind: "bundled" },
      artworkUrl: "/images/event-photo-booth/paris.webp",
      caption: { en: "", hi: "" },
      category: "travel",
      id: `scene-${crypto.randomUUID().slice(0, 8)}`,
      title: { en: "", hi: "" },
      visible: true,
    };
    setDraft((previous) => ({ ...previous, dirty: true, scenes: [...previous.scenes, scene] }));
    setSelectedId(scene.id);
    setMessage("New scene added. Enter its English and Hindi destination names.");
  };
  const moveScene = (direction: number) => {
    if (index < 0 || index + direction < 0 || index + direction >= draft.scenes.length) {
      return;
    }
    const scenes = [...draft.scenes];
    [scenes[index], scenes[index + direction]] = [scenes[index + direction], scenes[index]];
    setDraft((previous) => ({ ...previous, dirty: true, scenes }));
  };
  const moveUp = () => moveScene(-1);
  const moveDown = () => moveScene(1);
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
      setMessage("Draft saved. Publish when both formats are ready.");
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
    beginChange();
    try {
      const result = await props.uploadArtwork({ bytes: await prepareArtwork(file) });
      update({ ...selected, ...result });
      setMessage("Artwork uploaded to this draft. Save and publish to show it to visitors.");
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
    assign,
    busy,
    conflict,
    draft,
    draftStatus,
    error,
    index,
    loadLatest,
    moveDown,
    moveUp,
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

export function EventPhotoBoothEditor(props: EventPhotoBoothEditorProps) {
  const { state } = props;
  const {
    draft,
    selected,
    index,
    conflict,
    statusMessage,
    unpublished,
    draftStatus,
    busy,
    error,
    update,
    selectScene,
    addScene,
    moveUp,
    moveDown,
    loadLatest,
    save,
    publish,
    toggleAvailability,
    upload,
    assign,
  } = useBoothEditor(props);

  return (
    <div className="space-y-5 text-brand-dark">
      <section className={PANEL}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-xl">Event Photo Booth</h2>
            <p className="mt-1 max-w-2xl text-brand-muted text-sm">
              Manage the QR experience, destination scenes and usage. Participant photos stay out of
              this workspace.
            </p>
          </div>
          <a
            className="flex min-h-11 items-center rounded-lg px-3 font-medium text-citius-blue text-sm underline underline-offset-4"
            href="/photo-booth"
            rel="noopener"
            target="_blank"
          >
            Open participant page<span className="sr-only"> in a new tab</span>
          </a>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-brand-light px-3 py-1 font-medium text-sm">
            {state.availability === "open" ? "Open" : "Closed"}
          </span>
          <Button
            className="min-h-11"
            disabled={busy}
            onClick={toggleAvailability}
            type="button"
            variant="outline"
          >
            {state.availability === "open" ? "Close event" : "Open event"}
          </Button>
        </div>
        <p className="mt-2 text-brand-muted text-sm">
          Admins and Directors can use the participant page while closed. Assigned event staff can
          manage it here in either state.
        </p>
      </section>
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
      <form className={PANEL} onSubmit={save}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-lg">Destination scenes</h2>
          <span className="text-brand-muted text-sm">{draftStatus}</span>
        </div>
        <p className="mt-1 text-brand-muted text-sm">
          Changes stay in draft until you publish. Review the English and Hindi compositions in both
          formats.
        </p>
        {conflict ? (
          <p className="mt-3 text-amber-800 text-sm" role="alert">
            A newer draft is available. Your unsaved changes are preserved.
          </p>
        ) : null}
        <fieldset className="mt-4 min-w-0 space-y-4" disabled={busy}>
          <legend className="sr-only">Edit destination scene</legend>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 basis-56 space-y-1 text-sm">
              Scene
              <select className={INPUT} onChange={selectScene} value={selected?.id ?? ""}>
                {draft.scenes.map((scene, position) => (
                  <option key={scene.id} value={scene.id}>
                    {position + 1}. {scene.title.en || "New scene"}
                    {scene.visible ? "" : " (hidden)"}
                  </option>
                ))}
              </select>
            </label>
            <Button
              className="min-h-11"
              disabled={draft.scenes.length >= 24}
              onClick={addScene}
              type="button"
              variant="outline"
            >
              <Plus aria-hidden="true" size={16} />
              Add scene
            </Button>
            <Button
              aria-label="Move scene up"
              className="min-h-11 min-w-11"
              disabled={index <= 0}
              onClick={moveUp}
              type="button"
              variant="outline"
            >
              <ArrowUp aria-hidden="true" size={16} />
            </Button>
            <Button
              aria-label="Move scene down"
              className="min-h-11 min-w-11"
              disabled={index < 0 || index >= draft.scenes.length - 1}
              onClick={moveDown}
              type="button"
              variant="outline"
            >
              <ArrowDown aria-hidden="true" size={16} />
            </Button>
          </div>
          {selected ? (
            <>
              <SceneFields scene={selected} update={update} />
              <label className="block space-y-1 text-sm">
                Upload scene artwork
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className={`${INPUT} block file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-brand-light file:px-3`}
                  onChange={upload}
                  type="file"
                />
                <span className="block text-brand-muted text-xs">
                  JPEG, PNG or WebP, up to 12 MB. Artwork is resized before uploading. Use
                  destination scenery without participant photos.
                </span>
              </label>
            </>
          ) : null}
        </fieldset>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            className="min-h-11"
            disabled={busy || !draft.dirty || conflict}
            type="submit"
            variant="primary"
          >
            Save draft
          </Button>
          <Button
            className="min-h-11"
            disabled={busy || draft.dirty || conflict || !unpublished}
            onClick={publish}
            type="button"
            variant="outline"
          >
            Publish scenes
          </Button>
          {draft.dirty || conflict ? (
            <Button
              className="min-h-11"
              disabled={busy}
              onClick={loadLatest}
              type="button"
              variant="bare"
            >
              Discard my edits and load latest
            </Button>
          ) : null}
        </div>
        {selected ? <EventPhotoBoothPreview scene={selected} /> : null}
      </form>
      <section className={PANEL}>
        <h2 className="font-semibold text-lg">Aggregate usage</h2>
        <p className="mt-1 text-brand-muted text-sm">
          Action counts, not unique visitors or confirmed social posts. Download actions do not
          confirm a file was saved.
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
      </section>
      <StaffAssignments busy={busy} change={assign} props={props} />
    </div>
  );
}
