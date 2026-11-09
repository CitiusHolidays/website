"use client";

import Link from "next/link";
import { useState } from "react";
import { logout } from "@/lib/auth-client";

const BUTTON_CLASS =
  "account-focus inline-flex min-h-11 items-center justify-center rounded-full px-5 font-semibold text-sm transition-colors disabled:opacity-60";

/**
 * Shown instead of the Travel Account when this sign-in could not be linked to one traveller
 * record (`establishMyIdentity` returned a conflict). Trying again cannot fix that, so the
 * visitor gets a way to reach the team and a way to sign out.
 */
export default function AccountIdentityReview() {
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    setSignOutFailed(false);
    try {
      await logout();
      window.location.href = "/";
    } catch {
      setSigningOut(false);
      setSignOutFailed(true);
    }
  };

  return (
    <main className="account-shell flex min-h-screen items-center justify-center px-5 py-16">
      <section
        aria-labelledby="account-identity-review-title"
        className="account-card w-full max-w-lg rounded-2xl p-8"
      >
        <h1
          className="account-display text-3xl text-[var(--account-ink)] leading-tight"
          id="account-identity-review-title"
        >
          Your account needs a quick check
        </h1>
        <p className="mt-4 text-[var(--account-muted)] text-sm leading-6">
          We could not match this sign-in to a single traveller record, so your Travel Account is
          paused until our team checks it. Contact us and we will sort it out.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            className={`${BUTTON_CLASS} bg-[var(--account-night)] text-white hover:bg-[var(--account-ink)]`}
            href="/contact"
          >
            Contact us
          </Link>
          <button
            className={`${BUTTON_CLASS} border border-[var(--account-border)] text-[var(--account-ink)] hover:bg-[var(--account-paper)]`}
            disabled={signingOut}
            onClick={signOut}
            type="button"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
        {signOutFailed ? (
          <p className="mt-4 text-[var(--account-ink)] text-sm" role="alert">
            We could not sign you out. Check your connection and try again.
          </p>
        ) : null}
      </section>
    </main>
  );
}
