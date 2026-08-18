"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { heroMediaDecision } from "@/lib/publicMediaPolicy";

const DEFAULT_SOURCES = [
  { media: "(max-width: 768px)", src: "/hero-sm.mp4", type: "video/mp4" },
  { src: "/hero.mp4", type: "video/mp4" },
];

export default function HeroVideo({
  className,
  controlClassName = "",
  label = "background video",
  poster = "/gallery/hero-poster.webp",
  sources = DEFAULT_SOURCES,
}) {
  const videoRef = useRef(null);
  const [loadMedia, setLoadMedia] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection =
      navigator.connection ?? navigator.mozConnection ?? navigator.webkitConnection;
    let isVisible = false;

    const update = () => {
      const decision = heroMediaDecision({
        effectiveType: connection?.effectiveType,
        isVisible,
        prefersReducedMotion: reducedMotion.matches,
        saveData: connection?.saveData === true,
      });
      setLoadMedia(decision.load);
    };

    const observer =
      "IntersectionObserver" in globalThis
        ? new globalThis.IntersectionObserver(
            ([entry]) => {
              isVisible = entry?.isIntersecting === true;
              update();
            },
            { rootMargin: "160px 0px", threshold: 0.01 }
          )
        : null;
    if (observer && videoRef.current) {
      observer.observe(videoRef.current);
    } else {
      isVisible = true;
      update();
    }
    reducedMotion.addEventListener?.("change", update);
    connection?.addEventListener?.("change", update);

    return () => {
      observer?.disconnect();
      reducedMotion.removeEventListener?.("change", update);
      connection?.removeEventListener?.("change", update);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (!loadMedia) {
      video.pause();
      video.load();
      setIsPlaying(false);
      return;
    }
    video.load();
    if (userPaused) {
      video.pause();
      setIsPlaying(false);
      return;
    }
    let cancelled = false;
    video
      .play()
      .then(() => {
        if (!cancelled) {
          setIsPlaying(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Autoplay or media failure leaves the lightweight poster visible.
          setIsPlaying(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadMedia, userPaused]);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (isPlaying) {
      setUserPaused(true);
      video.pause();
      setIsPlaying(false);
      return;
    }
    setUserPaused(false);
    video
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }, [isPlaying]);

  const handlePause = useCallback(() => setIsPlaying(false), []);
  const handlePlay = useCallback(() => setIsPlaying(true), []);

  return (
    <>
      <video
        aria-hidden="true"
        autoPlay={loadMedia && !userPaused}
        className={className}
        loop
        muted
        onPause={handlePause}
        onPlay={handlePlay}
        playsInline
        poster={poster}
        preload="none"
        ref={videoRef}
        tabIndex={-1}
      >
        {loadMedia
          ? sources.map((source) => (
              <source
                key={`${source.media ?? "all"}-${source.src}`}
                media={source.media}
                src={source.src}
                type={source.type}
              />
            ))
          : null}
      </video>
      {loadMedia ? (
        <button
          aria-label={`${isPlaying ? "Pause" : "Play"} ${label}`}
          aria-pressed={!isPlaying}
          className={`material-floating absolute right-[max(6rem,var(--safe-area-inset-right))] bottom-[max(1rem,var(--safe-area-inset-bottom))] z-20 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/35 bg-public-night/65 px-4 font-semibold text-sm text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-public-night/85 focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-2 ${controlClassName}`.trim()}
          onClick={togglePlayback}
          type="button"
        >
          {isPlaying ? (
            <Pause aria-hidden="true" size={16} />
          ) : (
            <Play aria-hidden="true" size={16} />
          )}
          {isPlaying ? "Pause video" : "Play video"}
        </button>
      ) : null}
    </>
  );
}
