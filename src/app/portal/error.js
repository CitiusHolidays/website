"use client";

import PrivateAuthError from "@/components/auth/PrivateAuthError";

export default function PortalError({ reset }) {
  return <PrivateAuthError loginHref="/auth/connect" reset={reset} />;
}
