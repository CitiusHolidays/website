"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoothLanguage, BoothScene } from "@/lib/eventPhotoBooth/contracts";
import type { BoothCutout, BoothPhoto } from "@/lib/eventPhotoBooth/imageEngine";
import type { BoothFormat, BoothTransform } from "@/lib/eventPhotoBooth/imageGeometry";
import type { BoothCopyKey } from "@/lib/eventPhotoBooth/visitorCopy";
import type { createBoothMetrics } from "@/lib/eventPhotoBooth/visitorMetrics";

type Engine = typeof import("@/lib/eventPhotoBooth/imageEngine");
interface PreparedPhoto {
  destination: string;
  file: File;
  format: BoothFormat;
  key: string;
  sceneId: string;
  title: BoothScene["title"];
  url: string;
}
interface EditorResources {
  cutout: BoothCutout | null;
  photo: BoothPhoto | null;
  resultUrl: string;
  sourceUrl: string;
}
interface EditorOptions {
  canParticipate: boolean;
  format: BoothFormat;
  language: BoothLanguage;
  metrics: ReturnType<typeof createBoothMetrics>;
  mode: "cutout" | "frame";
  scene: BoothScene | undefined;
  transform: BoothTransform;
}

export function useBoothEditor(options: EditorOptions) {
  const { canParticipate, format, language, metrics, mode, scene, transform } = options;
  const [photo, setPhoto] = useState<BoothPhoto | null>(null);
  const [cutout, setCutout] = useState<BoothCutout | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [photoRevision, setPhotoRevision] = useState(0);
  const [ready, setReady] = useState<PreparedPhoto | null>(null);
  const [phase, setPhase] = useState<BoothCopyKey | null>(null);
  const [error, setError] = useState<BoothCopyKey | null>(null);
  const [rendering, setRendering] = useState(false);
  const [previewFormat, setPreviewFormat] = useState<BoothFormat | null>(null);
  const previewCanvas = useRef<HTMLCanvasElement>(null);
  const [renderRetry, setRenderRetry] = useState(0);
  const [savedFile, setSavedFile] = useState<File | null>(null);
  const engine = useRef<Engine | null>(null);
  const processor = useRef<ReturnType<Engine["createCutoutProcessor"]> | null>(null);
  const operation = useRef<AbortController | null>(null);
  const renderOperation = useRef<AbortController | null>(null);
  const resources = useRef<EditorResources>({
    cutout: null,
    photo: null,
    resultUrl: "",
    sourceUrl: "",
  });
  const completedCreation = useRef(new Set<string>());
  const artworkCache = useRef(new Map<string, HTMLImageElement>());
  const active = useRef(canParticipate);
  active.current = canParticipate;
  const renderKey = JSON.stringify([
    photoRevision,
    scene,
    format,
    language,
    mode,
    transform,
    renderRetry,
  ]);
  const busy = rendering || phase === "loading" || phase === "preparing" || phase === "processing";

  const cancel = useCallback(() => {
    operation.current?.abort();
    operation.current = null;
    renderOperation.current?.abort();
    setRendering(false);
    setError(null);
    setPhase("cancelled");
  }, []);

  useEffect(() => {
    if (!canParticipate) {
      operation.current?.abort();
      operation.current = null;
      renderOperation.current?.abort();
      setRendering(false);
      setPhase(null);
    }
  }, [canParticipate]);

  useEffect(
    () => () => {
      operation.current?.abort();
      renderOperation.current?.abort();
      processor.current?.dispose();
      engine.current?.releaseBoothPhoto(resources.current.photo);
      engine.current?.releaseBoothPhoto(resources.current.cutout);
      URL.revokeObjectURL(resources.current.sourceUrl);
      URL.revokeObjectURL(resources.current.resultUrl);
    },
    []
  );

  async function selectPhoto(file: File) {
    if (!active.current) {
      return;
    }
    operation.current?.abort();
    renderOperation.current?.abort();
    setRendering(false);
    const controller = new AbortController();
    operation.current = controller;
    setError(null);
    setPhase("loading");
    try {
      const loadedEngine = await import("@/lib/eventPhotoBooth/imageEngine");
      engine.current = loadedEngine;
      const next = await loadedEngine.loadSourcePhoto(file, { signal: controller.signal });
      if (controller.signal.aborted || !active.current) {
        loadedEngine.releaseBoothPhoto(next);
        return;
      }
      loadedEngine.releaseBoothPhoto(resources.current.photo);
      loadedEngine.releaseBoothPhoto(resources.current.cutout);
      URL.revokeObjectURL(resources.current.sourceUrl);
      const nextUrl = URL.createObjectURL(file);
      resources.current.photo = next;
      resources.current.cutout = null;
      resources.current.sourceUrl = nextUrl;
      setPhoto(next);
      setSourceUrl(nextUrl);
      setCutout(null);
      setPhotoRevision((value) => value + 1);
      setPhase(null);
    } catch {
      if (!controller.signal.aborted) {
        setError("uploadError");
        setPhase(null);
      }
    } finally {
      if (operation.current === controller) {
        operation.current = null;
      }
    }
  }

  async function createCutout() {
    if (!(active.current && photo && engine.current)) {
      return;
    }
    operation.current?.abort();
    renderOperation.current?.abort();
    setRendering(false);
    const controller = new AbortController();
    operation.current = controller;
    setError(null);
    setPhase("preparing");
    try {
      const { createCutoutProcessor } = await import("@/lib/eventPhotoBooth/imageEngine");
      if (controller.signal.aborted) {
        return;
      }
      processor.current ??= createCutoutProcessor();
      const next = await processor.current.segment(photo, {
        onProgress: (value) => {
          if (!controller.signal.aborted) {
            setPhase(value);
          }
        },
        signal: controller.signal,
      });
      if (controller.signal.aborted || !active.current) {
        engine.current.releaseBoothPhoto(next);
        return;
      }
      engine.current.releaseBoothPhoto(resources.current.cutout);
      resources.current.cutout = next;
      setCutout(next);
      setPhase(null);
    } catch {
      if (!controller.signal.aborted) {
        setError("cutoutError");
        setPhase(null);
      }
    } finally {
      if (operation.current === controller) {
        operation.current = null;
      }
    }
  }

  useEffect(() => {
    if (
      !(canParticipate && scene && photo && engine.current) ||
      operation.current ||
      (mode === "cutout" && !cutout)
    ) {
      setRendering(false);
      return;
    }
    const renderer = engine.current;
    const selectedScene = scene;
    const controller = new AbortController();
    renderOperation.current = controller;
    async function cachedArtwork(url: string) {
      const existing = artworkCache.current.get(url);
      if (existing) {
        return existing;
      }
      const artwork = await renderer.loadBoothArtwork(url, controller.signal);
      if (!controller.signal.aborted) {
        artworkCache.current.set(url, artwork);
      }
      return artwork;
    }
    setRendering(true);
    setPhase((current) => (current === "cancelled" ? null : current));
    setError((value) => (value === "renderError" ? null : value));
    let frame = 0;
    let exportTimer: ReturnType<typeof setTimeout>;
    async function prepare() {
      try {
        const [artwork, logo] = await Promise.all([
          cachedArtwork(selectedScene.artworkUrl),
          cachedArtwork("/images/event-photo-booth/citius-logo.webp"),
          document.fonts.ready,
        ]);
        if (controller.signal.aborted) {
          return;
        }
        // Keep the canvas and controls mounted. Drawing is cheap; PNG encoding waits
        // until input settles so native range gestures never wait on a blob round trip.
        frame = requestAnimationFrame(() => {
          if (controller.signal.aborted || !previewCanvas.current) {
            return;
          }
          try {
            const canvas = renderer.renderBoothPhoto({
              artwork,
              canvas: previewCanvas.current,
              caption: selectedScene.caption[language],
              cutout: cutout ?? undefined,
              format,
              language,
              logo,
              mode,
              photo: photo ?? undefined,
              title: selectedScene.title[language],
              transform,
            });
            setPreviewFormat(format);
            exportTimer = setTimeout(() => {
              encode(canvas);
            }, 200);
          } catch {
            failed();
          }
        });
      } catch {
        failed();
      }
    }
    function failed() {
      if (!controller.signal.aborted) {
        setError("renderError");
        setRendering(false);
      }
    }
    async function encode(canvas: HTMLCanvasElement) {
      try {
        const { exportBoothPhoto } = await import("@/lib/eventPhotoBooth/imageEngine");
        if (controller.signal.aborted) {
          return;
        }
        const blob = await exportBoothPhoto(canvas);
        if (controller.signal.aborted) {
          return;
        }
        const file = new File([blob], `citius-${selectedScene.id}-${format}.png`, {
          type: "image/png",
        });
        const url = URL.createObjectURL(file);
        URL.revokeObjectURL(resources.current.resultUrl);
        resources.current.resultUrl = url;
        setReady({
          destination: selectedScene.title.en,
          file,
          format,
          key: renderKey,
          sceneId: selectedScene.id,
          title: selectedScene.title,
          url,
        });
        setRendering(false);
        // One completion per source photo and chosen mode, not each slider/scene/format repaint.
        const creation = `${photoRevision}:${mode}`;
        if (!completedCreation.current.has(creation)) {
          completedCreation.current.add(creation);
          metrics.record("creation_completed", selectedScene.id);
        }
      } catch {
        failed();
      }
    }
    prepare();
    return () => {
      controller.abort();
      if (renderOperation.current === controller) {
        renderOperation.current = null;
      }
      cancelAnimationFrame(frame);
      clearTimeout(exportTimer);
    };
  }, [
    canParticipate,
    cutout,
    format,
    language,
    metrics,
    mode,
    photo,
    photoRevision,
    renderKey,
    scene,
    transform,
  ]);

  function reset() {
    operation.current?.abort();
    operation.current = null;
    renderOperation.current?.abort();
    setRendering(false);
    processor.current?.dispose();
    processor.current = null;
    engine.current?.releaseBoothPhoto(resources.current.photo);
    engine.current?.releaseBoothPhoto(resources.current.cutout);
    URL.revokeObjectURL(resources.current.sourceUrl);
    URL.revokeObjectURL(resources.current.resultUrl);
    resources.current = { cutout: null, photo: null, resultUrl: "", sourceUrl: "" };
    setPhoto(null);
    setCutout(null);
    setSourceUrl("");
    setReady(null);
    setPreviewFormat(null);
    setSavedFile(null);
    setPhase(null);
    setError(null);
  }

  const previousResult = Boolean(ready && ready.key !== renderKey);
  return {
    busy,
    cancel,
    canExport: Boolean(
      ready && !rendering && (!previousResult || error || phase === "cancelled" || !canParticipate)
    ),
    createCutout,
    cutout,
    dirty: Boolean(photo && (!ready || previousResult || ready.file !== savedFile)),
    error,
    hasPhoto: Boolean(photo),
    markSaved: (file: File) => setSavedFile(file),
    phase,
    previewCanvas,
    previewFormat,
    previousResult,
    ready,
    rendering,
    reset,
    retryPreview: () => setRenderRetry((value) => value + 1),
    selectPhoto,
    showLivePreview: Boolean(previewFormat && canParticipate && !error && phase !== "cancelled"),
    sourceUrl,
  };
}
