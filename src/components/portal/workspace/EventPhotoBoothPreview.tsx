"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/application-button";
import type { BoothLanguage, BoothScene } from "@/lib/eventPhotoBooth/contracts";
import {
  loadBoothArtwork,
  loadBoothLogo,
  renderBoothPhoto,
} from "@/lib/eventPhotoBooth/imageEngine";

function PreviewCanvases({ scene, language }: { scene: BoothScene; language: BoothLanguage }) {
  const portrait = useRef<HTMLCanvasElement>(null);
  const story = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    async function render() {
      try {
        const [artwork, logo] = await Promise.all([
          loadBoothArtwork(scene.artworkUrl),
          loadBoothLogo(),
          document.fonts.ready,
        ]);
        if (!(active && portrait.current && story.current)) {
          return;
        }
        const options = {
          artwork,
          caption: scene.caption[language],
          language,
          logo,
          mode: "frame" as const,
          title: scene.title[language],
        };
        renderBoothPhoto({ ...options, canvas: portrait.current, format: "portrait" });
        renderBoothPhoto({ ...options, canvas: story.current, format: "story" });
        setReady(true);
      } catch (failure) {
        if (active) {
          setError(
            failure instanceof Error ? failure.message : "Unable to load scene previews. Try again."
          );
        }
      }
    }
    render();
    return () => {
      active = false;
    };
  }, [scene.artworkUrl, scene.title, scene.caption, language]);
  return (
    <div>
      {error ? (
        <p className="text-red-800 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {ready || error ? null : (
        <p className="text-brand-muted text-sm" role="status">
          Preparing both previews…
        </p>
      )}
      <div className="mt-3 grid items-start gap-4 sm:grid-cols-2">
        <figure>
          <canvas
            aria-label={`${scene.title[language]} 4:5 portrait preview`}
            className="h-auto w-full rounded-lg border border-brand-border"
            height={1350}
            ref={portrait}
            width={1080}
          />
          <figcaption className="mt-2 text-brand-muted text-sm">
            4:5 portrait · 1080 × 1350
          </figcaption>
        </figure>
        <figure>
          <canvas
            aria-label={`${scene.title[language]} 9:16 Story preview`}
            className="h-auto w-full rounded-lg border border-brand-border"
            height={1920}
            ref={story}
            width={1080}
          />
          <figcaption className="mt-2 text-brand-muted text-sm">
            9:16 Story · 1080 × 1920
          </figcaption>
        </figure>
      </div>
    </div>
  );
}

export function EventPhotoBoothPreview({ scene }: { scene: BoothScene }) {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<BoothLanguage>("en");
  const [retry, setRetry] = useState(0);
  const toggle = () => setOpen((value) => !value);
  const changeLanguage = (event: ChangeEvent<HTMLSelectElement>) =>
    setLanguage(event.target.value === "hi" ? "hi" : "en");
  const refresh = () => setRetry((value) => value + 1);
  const previewKey = JSON.stringify([scene, language, retry]);
  return (
    <div className="mt-5 border-brand-border border-t pt-4">
      <Button
        aria-expanded={open}
        className="min-h-11"
        onClick={toggle}
        type="button"
        variant="outline"
      >
        {open ? "Hide previews" : "Preview both formats"}
      </Button>
      {open ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm">
              Preview language
              <select
                aria-label="Preview language"
                className="block min-h-11 rounded-lg border border-brand-border bg-white px-3"
                onChange={changeLanguage}
                value={language}
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
              </select>
            </label>
            <Button className="min-h-11" onClick={refresh} type="button" variant="bare">
              Reload previews
            </Button>
          </div>
          <p className="text-brand-muted text-sm">
            Scene artwork and branding, using the visitor export renderer. No participant photo is
            loaded.
          </p>
          <PreviewCanvases key={previewKey} language={language} scene={scene} />
        </div>
      ) : null}
    </div>
  );
}
