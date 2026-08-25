"use client";

import PrivateAuthError from "@/components/auth/PrivateAuthError";

export default function AuthError({ reset }) {
  return <PrivateAuthError loginHref="/auth/guest" reset={reset} scenic />;
}
