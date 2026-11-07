"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const Analytics = dynamic(
  () => import("@vercel/analytics/next").then((module) => module.Analytics),
  { ssr: false }
);

const SpeedInsights = dynamic(
  () => import("@vercel/speed-insights/next").then((module) => module.SpeedInsights),
  { ssr: false }
);

// Pages that carry a one-time token in the URL fragment: no third-party page measurement there.
const UNMEASURED_PATHS = new Set(["/tour-feedback", "/app/invite", "/app/sign-in"]);

function RouteRuntimeInsights() {
  const pathname = usePathname();
  if (UNMEASURED_PATHS.has(pathname)) {
    return null;
  }
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

export default function RuntimeInsights() {
  return (
    <Suspense fallback={null}>
      <RouteRuntimeInsights />
    </Suspense>
  );
}
