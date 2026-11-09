"use client";

import PortalRouteError from "@/components/portal/PortalRouteError";

export default function PortalError({ error, retry }) {
  return <PortalRouteError error={error} retry={retry} />;
}
