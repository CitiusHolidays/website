"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

export function shouldAdvanceSlideshow({ inView, itemCount, pageVisible, userWantsPlayback }) {
  return itemCount > 1 && inView && pageVisible && userWantsPlayback;
}

export function useSlideshowPlayback({ intervalMs, itemCount, onAdvance }) {
  const sectionRef = useRef(null);
  const shouldReduceMotion = !!useReducedMotion();
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden"
  );
  // Keep the server and first client render identical. Motion cannot know the
  // browser preference during SSR, so reduced motion is applied after hydration.
  const [userWantsPlayback, setUserWantsPlayback] = useState(true);

  useEffect(() => {
    if (shouldReduceMotion) {
      setUserWantsPlayback(false);
    }
  }, [shouldReduceMotion]);

  useEffect(() => {
    const handleVisibilityChange = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!(section && "IntersectionObserver" in window)) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? false),
      { threshold: 0.15 }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const isPlaying = shouldAdvanceSlideshow({
    inView,
    itemCount,
    pageVisible,
    userWantsPlayback,
  });

  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    const timer = window.setInterval(onAdvance, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, isPlaying, onAdvance]);

  const togglePlayback = useCallback(() => {
    setUserWantsPlayback((current) => !current);
  }, []);

  return {
    isPlaying,
    sectionRef,
    togglePlayback,
  };
}
