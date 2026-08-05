"use client";

import PrivateAuthError from "@/components/auth/PrivateAuthError";

export default function AuthenticatedError({ reset }) {
  return <PrivateAuthError loginHref="/auth/guest" reset={reset} />;
}
