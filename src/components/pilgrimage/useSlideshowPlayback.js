"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

function subscribeToPageVisibility(listener) {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
}

const getPageVisibility = () => document.visibilityState !== "hidden";
const getServerPageVisibility = () => true;
const subscribeToHydration = () => () => undefined;
const getHydratedSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

export function shouldAdvanceSlideshow({ inView, itemCount, pageVisible, userWantsPlayback }) {
  return itemCount > 1 && inView && pageVisible && userWantsPlayback;
}

export function useSlideshowPlayback({ intervalMs, itemCount, onAdvance }) {
  const sectionRef = useRef(null);
  const shouldReduceMotion = !!useReducedMotion();
  const [inView, setInView] = useState(true);
  const pageVisible = useSyncExternalStore(
    subscribeToPageVisibility,
    getPageVisibility,
    getServerPageVisibility
  );
  // Keep the server and first client render identical. Motion cannot know the
  // browser preference during SSR, so reduced motion is applied after hydration.
  const [playbackRequested, setPlaybackRequested] = useState(true);
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydrationSnapshot
  );
  const userWantsPlayback = playbackRequested && !(isHydrated && shouldReduceMotion);

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

  const togglePlayback = () => {
    setPlaybackRequested((current) => !current);
  };

  return {
    isPlaying,
    sectionRef,
    togglePlayback,
  };
}
