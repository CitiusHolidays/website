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

function RouteRuntimeInsights() {
  const pathname = usePathname();
  if (pathname === "/tour-feedback") {
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
