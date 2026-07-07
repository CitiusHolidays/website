"use client";

/**
 * Hero background video: WebM first (smaller), MP4 fallback.
 * Add `public/hero.webm` (encode from hero.mp4) for best load; missing sources are skipped by the browser.
 * Optional `hero-sm.webm` / `hero-sm.mp4` for narrow viewports (same duration, lower resolution).
 */
export default function HeroVideo({ className }) {
  return (
    <video
      aria-hidden
      autoPlay
      className={className}
      loop
      muted
      playsInline
      poster="/gallery/hero-poster.webp"
      preload="auto"
      tabIndex={-1}
    >
      <source media="(max-width: 768px)" src="/hero-sm.webm" type="video/webm" />
      <source media="(max-width: 768px)" src="/hero-sm.mp4" type="video/mp4" />
      <source src="/hero.webm" type="video/webm" />
      <source src="/hero.mp4" type="video/mp4" />
    </video>
  );
}
