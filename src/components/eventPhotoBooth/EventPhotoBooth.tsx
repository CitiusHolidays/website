"use client";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { Camera, Check, Download, ImagePlus, RotateCcw, Share2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  ControlledAlertDialog,
  ControlledAlertDialogDescription,
  ControlledAlertDialogTitle,
} from "@/components/ui/application-dialog";
import {
  BOOTH_THUMBNAIL_URLS,
  type BoothCategory,
  type BoothLanguage,
  type BoothParticipantState,
  type BoothScene,
} from "@/lib/eventPhotoBooth/contracts";
import {
  type BoothFormat,
  type BoothTransform,
  clampTransform,
  DEFAULT_TRANSFORM,
  PHOTO_ACCEPT,
} from "@/lib/eventPhotoBooth/imageGeometry";
import { type BoothCopyKey, boothCopy } from "@/lib/eventPhotoBooth/visitorCopy";
import { createBoothMetrics } from "@/lib/eventPhotoBooth/visitorMetrics";
import { getPhotoBoothContactHref } from "@/lib/public/contactIntent";
import styles from "./EventPhotoBooth.module.css";
import { useBoothEditor } from "./useBoothEditor";

export default function EventPhotoBooth() {
  const state = useQuery(api.eventPhotoBooth.getParticipantState, {});
  return <EventPhotoBoothView state={state} />;
}

/** The same view consumes live server access and local, target-neutral browser proof. */
function useVisitorBooth(state: BoothParticipantState | undefined) {
  const [language, setLanguage] = useState<BoothLanguage>("en");
  const [category, setCategory] = useState<BoothCategory>("travel");
  const [sceneId, setSceneId] = useState("");
  const [format, setFormat] = useState<BoothFormat>("portrait");
  const [mode, setMode] = useState<"cutout" | "frame">("cutout");
  const [transform, setTransform] = useState<BoothTransform>(DEFAULT_TRANSFORM);
  const [shareStatus, setShareStatus] = useState<BoothCopyKey | null>(null);
  const [sharing, setSharing] = useState(false);
  const [pendingDiscard, setPendingDiscard] = useState<(() => void) | null>(null);
  const [metrics] = useState(createBoothMetrics);
  const retainedScene = useRef<BoothScene | undefined>(undefined);
  const visited = useRef(false);
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const chooseButton = useRef<HTMLButtonElement>(null);
  const pageHeading = useRef<HTMLHeadingElement>(null);
  const focusNextResult = useRef(false);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const copy = boothCopy(language);
  const canParticipate = state?.canParticipate === true;
  const availableScenes = state?.scenes ?? [];
  const liveScene = availableScenes.find((item) => item.id === sceneId) ?? availableScenes[0];
  if (liveScene) {
    retainedScene.current = liveScene;
  }
  const scene = liveScene ?? retainedScene.current;
  const editor = useBoothEditor({
    canParticipate,
    format,
    language,
    metrics,
    mode,
    scene,
    transform,
  });
  const { ready } = editor;
  const confirmedClosed = state && !canParticipate;
  const showEditor = Boolean((canParticipate && scene) || editor.hasPhoto);

  useEffect(() => {
    if (canParticipate && !visited.current) {
      visited.current = true;
      metrics.record("visit");
    }
  }, [canParticipate, metrics]);

  useEffect(() => {
    const flushHidden = () => {
      if (document.visibilityState === "hidden") {
        metrics.flush();
      }
    };
    window.addEventListener("pagehide", metrics.flush);
    document.addEventListener("visibilitychange", flushHidden);
    return () => {
      window.removeEventListener("pagehide", metrics.flush);
      document.removeEventListener("visibilitychange", flushHidden);
      metrics.flush();
    };
  }, [metrics]);

  useEffect(() => {
    if (!editor.dirty) {
      return;
    }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [editor.dirty]);

  async function share() {
    if (!(ready && editor.canExport) || sharing) {
      return;
    }
    const { file } = ready;
    try {
      if (
        !("share" in navigator && "canShare" in navigator && navigator.canShare({ files: [file] }))
      ) {
        setShareStatus("shareUnavailable");
        return;
      }
      // Call the native share API before any await to retain the button's user activation.
      metrics.record("share_attempt", ready.sceneId);
      const handoff = navigator.share({ files: [file], title: "Citius Holidays" });
      setSharing(true);
      await handoff;
      editor.markSaved(file);
      setShareStatus("shareHandedOff");
    } catch (error) {
      setShareStatus(
        error instanceof Error && error.name === "AbortError" ? "shareCancelled" : "shareFailed"
      );
    } finally {
      setSharing(false);
    }
  }

  function download() {
    if (!(ready && editor.canExport)) {
      return;
    }
    const link = document.createElement("a");
    link.href = ready.url;
    link.download = ready.file.name;
    document.body.append(link);
    link.click();
    link.remove();
    metrics.record("download_action", ready.sceneId);
    editor.markSaved(ready.file);
    setShareStatus("downloaded");
  }

  function requestDiscard(action: () => void) {
    if (editor.dirty) {
      setPendingDiscard(() => action);
    } else {
      action();
    }
  }

  function startOver() {
    requestDiscard(() => {
      editor.reset();
      setTransform(DEFAULT_TRANSFORM);
      setShareStatus(null);
      if (canParticipate) {
        chooseButton.current?.focus();
      } else {
        pageHeading.current?.focus();
      }
    });
  }

  function chooseMode(nextMode: "cutout" | "frame") {
    if (editor.busy) {
      editor.cancel();
    }
    focusNextResult.current = nextMode === "frame" && editor.hasPhoto;
    setMode(nextMode);
    setShareStatus(null);
  }

  function changePhoto(file: File | undefined) {
    if (!(file && canParticipate)) {
      return;
    }
    requestDiscard(() => {
      setShareStatus(null);
      setTransform(DEFAULT_TRANSFORM);
      focusNextResult.current = mode === "frame";
      editor.selectPhoto(file);
    });
  }

  function createPhoto() {
    focusNextResult.current = true;
    editor.createCutout();
  }

  useEffect(() => {
    if (ready && !editor.busy && !editor.rendering && focusNextResult.current) {
      focusNextResult.current = false;
      previewHeading.current?.focus({ preventScroll: true });
      previewHeading.current?.scrollIntoView({ behavior: "instant", block: "start" });
    }
  }, [ready, editor.busy, editor.rendering]);

  const showProgress = editor.busy || editor.rendering;
  let status = ready ? copy.ready : "";
  if (editor.phase) {
    status = copy[editor.phase];
  }
  if (editor.rendering) {
    status = copy.rendering;
  }

  return {
    availableScenes,
    camera,
    canParticipate,
    category,
    changePhoto,
    chooseButton,
    chooseMode,
    confirmedClosed,
    copy,
    createPhoto,
    download,
    editor,
    format,
    language,
    metrics,
    mode,
    pageHeading,
    pendingDiscard,
    picker,
    previewHeading,
    ready,
    scene,
    sceneId,
    setCategory,
    setFormat,
    setLanguage,
    setPendingDiscard,
    setSceneId,
    setShareStatus,
    setTransform,
    share,
    shareStatus,
    sharing,
    showEditor,
    showProgress,
    startOver,
    state,
    status,
    transform,
  };
}

type VisitorView = ReturnType<typeof useVisitorBooth>;

export function EventPhotoBoothView({ state }: { state: BoothParticipantState | undefined }) {
  const view = useVisitorBooth(state);
  const {
    language,
    setLanguage,
    copy,
    confirmedClosed,
    editor,
    canParticipate,
    availableScenes,
    showEditor,
  } = view;
  return (
    <div className={styles.booth} lang={language}>
      <header className={styles.header}>
        <a aria-label={copy.home} href="/">
          <Image
            alt="Citius Holidays"
            height={58}
            priority
            src="/images/event-photo-booth/citius-logo.webp"
            unoptimized
            width={138}
          />
        </a>
        <fieldset className={styles.languages}>
          <legend className="sr-only">{copy.language}</legend>
          <button
            aria-pressed={language === "en"}
            lang="en"
            onClick={() => setLanguage("en")}
            type="button"
          >
            English
          </button>
          <button
            aria-pressed={language === "hi"}
            lang="hi"
            onClick={() => setLanguage("hi")}
            type="button"
          >
            हिन्दी
          </button>
        </fieldset>
      </header>

      <div className={styles.content}>
        <div className={styles.intro}>
          <h1 ref={view.pageHeading} tabIndex={-1}>
            {copy.title} <em>{copy.titleAccent}</em>
          </h1>
          <p>{copy.intro}</p>
        </div>
        {state ? null : (
          <p className={styles.notice} role="status">
            {copy.checking}
          </p>
        )}
        {state?.privilegedAccess && state.availability === "closed" ? (
          <p className={styles.notice}>{copy.privileged}</p>
        ) : null}
        {confirmedClosed ? (
          <section className={styles.notice}>
            <h2>{copy.closed}</h2>
            <p>{editor.hasPhoto ? copy.closedDuring : copy.closedHelp}</p>
            <div className={styles.links}>
              <a href="/">{copy.explore}</a>
              <a href="/pilgrimage">{copy.explorePilgrimage}</a>
            </div>
          </section>
        ) : null}
        {canParticipate && !availableScenes.length ? (
          <p className={styles.notice} role="status">
            {copy.noScenes}
          </p>
        ) : null}

        {showEditor ? (
          <div className={styles.workspace}>
            <SceneChoices view={view} />
            <PhotoPreview view={view} />
            <PhotoControls view={view} />
            <PhotoOutputControls view={view} />
          </div>
        ) : null}
        <DiscardPhotoDialog view={view} />
        <footer className={styles.footer}>
          <p>{copy.artworkNote}</p>
          <a href="/policies">{copy.privacyLink}</a>
        </footer>
      </div>
    </div>
  );
}

function SceneChoices({ view }: { view: VisitorView }) {
  const {
    canParticipate,
    copy,
    category,
    setCategory,
    availableScenes,
    language,
    scene,
    setSceneId,
    setShareStatus,
  } = view;
  return (
    <fieldset className={styles.sceneChoices} disabled={!canParticipate}>
      <legend className={styles.sectionTitle}>{copy.chooseScene}</legend>
      <div className={styles.switches}>
        {(["travel", "pilgrimage"] as const).map((value) => (
          <button
            aria-pressed={category === value}
            key={value}
            onClick={() => setCategory(value)}
            type="button"
          >
            {copy[value]}
          </button>
        ))}
      </div>
      <div className={styles.scenes}>
        {availableScenes
          .filter((item) => item.category === category)
          .map((item) => (
            <button
              aria-label={`${item.title[language]}${item.id === scene?.id ? ` · ${copy.selected}` : ""}`}
              aria-pressed={item.id === scene?.id}
              className={styles.scene}
              key={item.id}
              onClick={() => {
                setSceneId(item.id);
                setShareStatus(null);
              }}
              type="button"
            >
              <span className={styles.thumbnail}>
                <picture>
                  {item.artwork.kind === "bundled" ? (
                    <source
                      sizes="(max-width: 700px) 30vw, 150px"
                      srcSet={`${BOOTH_THUMBNAIL_URLS[item.artwork.key].small} 192w, ${BOOTH_THUMBNAIL_URLS[item.artwork.key].large} 384w`}
                      type="image/webp"
                    />
                  ) : null}
                  <Image
                    alt=""
                    fill
                    sizes="(max-width: 700px) 30vw, 150px"
                    src={
                      item.artwork.kind === "bundled"
                        ? BOOTH_THUMBNAIL_URLS[item.artwork.key].large
                        : item.artworkUrl
                    }
                    unoptimized={item.artwork.kind === "bundled"}
                  />
                </picture>
              </span>
              <span>
                {item.title[language]}
                {item.id === scene?.id ? <Check aria-hidden size={16} /> : null}
              </span>
            </button>
          ))}
      </div>
    </fieldset>
  );
}

function PhotoControls({ view }: { view: VisitorView }) {
  const {
    copy,
    canParticipate,
    changePhoto,
    picker,
    camera,
    editor,
    mode,
    chooseMode,
    chooseButton,
    createPhoto,
  } = view;
  return (
    <section aria-labelledby="booth-photo-title" className={styles.photoSection}>
      <details
        className={styles.photoOptions}
        open={!view.ready || Boolean(editor.error) || (!editor.cutout && mode === "cutout")}
      >
        <summary className={styles.sectionTitle} id="booth-photo-title">
          {view.ready ? copy.photoOptions : copy.addPhoto}
        </summary>
        <p className={styles.help}>{copy.photoIntro}</p>
        <input
          accept={PHOTO_ACCEPT}
          aria-describedby="booth-photo-help"
          aria-label={copy.choosePhoto}
          className="sr-only"
          disabled={!canParticipate}
          onChange={(event) => {
            changePhoto(event.target.files?.[0]);
            event.target.value = "";
          }}
          ref={picker}
          tabIndex={-1}
          type="file"
        />
        <input
          accept={PHOTO_ACCEPT}
          aria-label={copy.camera}
          capture="user"
          className="sr-only"
          disabled={!canParticipate}
          onChange={(event) => {
            changePhoto(event.target.files?.[0]);
            event.target.value = "";
          }}
          ref={camera}
          tabIndex={-1}
          type="file"
        />
        <div className={styles.actions}>
          <button
            className={styles.secondary}
            disabled={!canParticipate}
            onClick={() => picker.current?.click()}
            ref={chooseButton}
            type="button"
          >
            <ImagePlus aria-hidden size={18} />
            {copy.choosePhoto}
          </button>
          <button
            className={styles.secondary}
            disabled={!canParticipate}
            onClick={() => camera.current?.click()}
            type="button"
          >
            <Camera aria-hidden size={18} />
            {copy.camera}
          </button>
        </div>
        <details className={styles.tips}>
          <summary>{copy.photoTips}</summary>
          <p className={styles.help} id="booth-photo-help">
            {copy.photoHelp}
          </p>
        </details>
        {editor.sourceUrl ? (
          <div className={styles.source}>
            <Image alt={copy.sourceAlt} height={72} src={editor.sourceUrl} unoptimized width={72} />
            <p>{copy.privacy}</p>
          </div>
        ) : (
          <p className={styles.help}>{copy.privacy}</p>
        )}

        <fieldset className={styles.mode} disabled={!canParticipate}>
          <legend className="sr-only">{copy.addPhoto}</legend>
          <div className={styles.switches}>
            <button
              aria-pressed={mode === "cutout"}
              onClick={() => chooseMode("cutout")}
              type="button"
            >
              {copy.cutout}
            </button>
            <button
              aria-pressed={mode === "frame"}
              onClick={() => chooseMode("frame")}
              type="button"
            >
              {copy.frame}
            </button>
          </div>
          <p className={styles.help}>{mode === "cutout" ? copy.cutoutHelp : copy.frameHelp}</p>
        </fieldset>
        {mode === "cutout" ? (
          <>
            {editor.cutout ? null : <p className={styles.help}>{copy.firstLoad}</p>}
            <button
              className={styles.primary}
              disabled={!(canParticipate && editor.hasPhoto) || editor.busy}
              onClick={createPhoto}
              type="button"
            >
              {editor.cutout || editor.error === "cutoutError" ? copy.retryCutout : copy.create}
            </button>
          </>
        ) : null}
      </details>
    </section>
  );
}

function PhotoPreview({ view }: { view: VisitorView }) {
  const {
    copy,
    previewHeading,
    canParticipate,
    format,
    setFormat,
    setShareStatus,
    showProgress,
    ready,
    scene,
    language,
    status,
    editor,
  } = view;
  const displayedFormat = editor.showLivePreview ? editor.previewFormat : (ready?.format ?? format);
  return (
    <section aria-labelledby="booth-preview-title" className={styles.previewSection}>
      <div className={styles.previewHeader}>
        <h2
          className={styles.sectionTitle}
          id="booth-preview-title"
          ref={previewHeading}
          tabIndex={-1}
        >
          {copy.preview}
        </h2>
        <p className={styles.help}>{copy.previewHelp}</p>
      </div>
      <fieldset className={styles.switches} disabled={!canParticipate}>
        <legend className="sr-only">{copy.format}</legend>
        {(["portrait", "story"] as const).map((value) => (
          <button
            aria-pressed={format === value}
            key={value}
            onClick={() => {
              setFormat(value);
              setShareStatus(null);
            }}
            type="button"
          >
            {copy[value]}
          </button>
        ))}
      </fieldset>
      <div
        aria-busy={showProgress}
        className={styles.preview}
        data-format={displayedFormat}
        style={{ aspectRatio: displayedFormat === "portrait" ? "4 / 5" : "9 / 16" }}
      >
        <canvas
          aria-label={copy.previewAlt}
          hidden={!editor.showLivePreview}
          ref={editor.previewCanvas}
          role="img"
        />
        {ready && !editor.showLivePreview ? (
          <Image
            alt={copy.previewAlt}
            fill
            sizes="(max-width: 700px) 90vw, 420px"
            src={ready.url}
            unoptimized
          />
        ) : null}
        {!(ready || editor.showLivePreview) && scene ? (
          <>
            <Image
              alt={scene.title[language]}
              fill
              sizes="(max-width: 700px) 90vw, 420px"
              src={scene.artworkUrl}
              unoptimized
            />
            <div className={styles.previewMessage}>
              <strong>{showProgress ? status : copy.emptyPreview}</strong>
              <p>{showProgress ? copy.privacy : copy.emptyPreviewHelp}</p>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function PhotoOutputControls({ view }: { view: VisitorView }) {
  const {
    copy,
    canParticipate,
    mode,
    editor,
    transform,
    setTransform,
    setShareStatus,
    ready,
    language,
    download,
    sharing,
    share,
    shareStatus,
    startOver,
    scene,
    metrics,
  } = view;
  return (
    <section aria-label={copy.adjust} className={styles.outputControls}>
      {mode === "cutout" && editor.cutout ? (
        <fieldset className={styles.adjustments} disabled={!canParticipate}>
          <legend>{copy.adjust}</legend>
          {(
            [
              { key: "x", label: copy.horizontal, max: 0.65, min: -0.65 },
              { key: "y", label: copy.vertical, max: 0.65, min: -0.65 },
              { key: "scale", label: copy.size, max: 2.5, min: 0.35 },
            ] as const
          ).map((control) => (
            <label key={control.key}>
              {control.label}
              <input
                max={control.max}
                min={control.min}
                onChange={(event) => {
                  setTransform(
                    clampTransform({
                      ...transform,
                      [control.key]: Number(event.target.value),
                    })
                  );
                  setShareStatus(null);
                }}
                step="0.01"
                type="range"
                value={transform[control.key]}
              />
            </label>
          ))}
          <button
            className={styles.textButton}
            onClick={() => setTransform(DEFAULT_TRANSFORM)}
            type="button"
          >
            <RotateCcw aria-hidden size={16} />
            {copy.resetPlacement}
          </button>
        </fieldset>
      ) : null}
      {ready && editor.previousResult && !editor.rendering ? (
        <p className={styles.notice} role="status">
          {copy.previousResult}: {ready.title[language]} · {copy[ready.format]}
        </p>
      ) : null}
      <div className={styles.actions}>
        <button
          className={styles.primary}
          disabled={!editor.canExport}
          onClick={download}
          type="button"
        >
          <Download aria-hidden size={18} />
          {copy.save}
        </button>
        <button
          className={styles.secondary}
          disabled={!editor.canExport || sharing}
          onClick={share}
          type="button"
        >
          <Share2 aria-hidden size={18} />
          {sharing ? copy.sharing : copy.share}
        </button>
      </div>
      <details className={styles.tips}>
        <summary>{copy.shareTips}</summary>
        <p className={styles.help}>{copy.shareHelp}</p>
      </details>
      <p aria-live="polite" className={styles.status} role="status">
        {shareStatus ? copy[shareStatus] : ""}
      </p>
      {editor.busy ? (
        <button className={styles.secondary} onClick={editor.cancel} type="button">
          {copy.cancel}
        </button>
      ) : null}
      {editor.phase === "cancelled" && (mode === "frame" || editor.cutout) ? (
        <button
          className={styles.secondary}
          disabled={!canParticipate}
          onClick={editor.retryPreview}
          type="button"
        >
          {copy.retryPreview}
        </button>
      ) : null}
      {editor.error ? (
        <div className={styles.error} role="alert">
          <p>{copy[editor.error]}</p>
          {editor.error === "renderError" ? (
            <button
              className={styles.secondary}
              disabled={!canParticipate}
              onClick={editor.retryPreview}
              type="button"
            >
              {copy.retryPreview}
            </button>
          ) : null}
        </div>
      ) : null}
      <p aria-live="polite" className={styles.status} role="status">
        {view.status}
      </p>
      {editor.hasPhoto ? (
        <button className={styles.textButton} onClick={startOver} type="button">
          {copy.startOver}
        </button>
      ) : null}
      {ready && scene ? (
        <div className={styles.enquiry}>
          <a
            href={getPhotoBoothContactHref(ready.destination)}
            onClick={() => {
              metrics.record("enquiry_entry", ready.sceneId);
              metrics.flush();
            }}
          >
            {copy.plan}
          </a>
          <p className={styles.help}>{copy.enquiryHelp}</p>
        </div>
      ) : null}
    </section>
  );
}

function DiscardPhotoDialog({ view }: { view: VisitorView }) {
  const { pendingDiscard, setPendingDiscard, copy, chooseButton, canParticipate, pageHeading } =
    view;
  const cancelButton = useRef<HTMLButtonElement>(null);
  return (
    <ControlledAlertDialog
      backdropClassName="absolute inset-0 bg-public-night/60"
      initialFocus={cancelButton}
      onOpenChange={(open) => {
        if (!open) {
          setPendingDiscard(null);
        }
      }}
      open={Boolean(pendingDiscard)}
      popupClassName="relative w-full max-w-md rounded-xl bg-public-paper p-6 text-public-ink shadow-xl"
      popupFinalFocus={canParticipate ? chooseButton : pageHeading}
      triggerless
      viewportClassName="fixed inset-0 z-50 grid place-items-center p-4"
    >
      <ControlledAlertDialogTitle className="font-heading font-semibold text-xl">
        {copy.unsavedTitle}
      </ControlledAlertDialogTitle>
      <ControlledAlertDialogDescription className="mt-3 text-sm leading-relaxed">
        {copy.unsaved}
      </ControlledAlertDialogDescription>
      <div className={styles.actions}>
        <button
          className={styles.primary}
          onClick={() => setPendingDiscard(null)}
          ref={cancelButton}
          type="button"
        >
          {copy.cancel}
        </button>
        <button
          className={styles.secondary}
          onClick={() => {
            setPendingDiscard(null);
            pendingDiscard?.();
          }}
          type="button"
        >
          {copy.continue}
        </button>
      </div>
    </ControlledAlertDialog>
  );
}
