"use client";

import { useEffect, useRef, useState } from "react";
import { heroMediaDecision } from "@/lib/publicMediaPolicy";

export default function HeroVideo({ className }) {
  const videoRef = useRef(null);
  const [loadMedia, setLoadMedia] = useState(false);

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
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              isVisible = entry?.isIntersecting === true;
              update();
            },
            { rootMargin: "160px 0px", threshold: 0.01 }
          );
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
      return;
    }
    video.load();
    void video.play().catch(() => {
      // Autoplay or media failure leaves the lightweight poster visible.
    });
  }, [loadMedia]);

  return (
    <video
      aria-hidden
      autoPlay={loadMedia}
      className={className}
      loop
      muted
      playsInline
      poster="/gallery/hero-poster.webp"
      preload="none"
      ref={videoRef}
      tabIndex={-1}
    >
      {loadMedia ? (
        <>
          <source media="(max-width: 768px)" src="/hero-sm.webm" type="video/webm" />
          <source media="(max-width: 768px)" src="/hero-sm.mp4" type="video/mp4" />
          <source src="/hero.webm" type="video/webm" />
          <source src="/hero.mp4" type="video/mp4" />
        </>
      ) : null}
    </video>
  );
}
