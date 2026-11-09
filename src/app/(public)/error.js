"use client";

import PublicRouteError from "@/components/layout/PublicRouteError";

export default function PublicError({ error, retry }) {
  return <PublicRouteError error={error} retry={retry} underPublicHeader />;
}
