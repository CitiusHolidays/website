"use client";

import PublicRouteError from "@/components/layout/PublicRouteError";

// Catches failures in route-group layouts (public chrome, account, auth) and in routes that sit
// directly under the root layout. Groups with their own error.js handle their pages first.
export default function RootError({ error, retry }) {
  return <PublicRouteError error={error} retry={retry} />;
}
