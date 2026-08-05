"use client";

import PrivateAuthError from "@/components/auth/PrivateAuthError";

export default function AuthError({ reset }) {
  return <PrivateAuthError reset={reset} />;
}
