"use client";

import Link from "next/link";
import { isRuntimeString } from "@/lib/runtimeValues";

/**
 * Public-site error panel for route error boundaries. It renders inside whatever chrome survived
 * the failure (the public header and footer for `(public)/error.js`, bare root layout otherwise),
 * so it carries its own paper surface and always offers a retry and a way home.
 */
export default function PublicRouteError({ error, retry }) {
  // Server Component failures arrive as Error instances carrying a log-matching digest.
  const digest = error instanceof Error && isRuntimeString(error.digest) ? error.digest : null;
  return (
    <main className="flex min-h-[70vh] items-center bg-public-paper px-6 py-24 text-public-ink">
      <section aria-labelledby="public-route-error-title" className="mx-auto w-full max-w-xl">
        <h1
          className="font-heading font-semibold text-3xl leading-tight md:text-4xl"
          id="public-route-error-title"
        >
          This page didn’t load
        </h1>
        <p className="mt-4 text-base text-public-muted leading-relaxed md:text-lg">
          Something went wrong on our side. Try again, or head back to the Citius Holidays home
          page.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-public-blue px-6 font-semibold text-public-surface text-sm transition-colors hover:bg-public-night focus-visible:outline-2 focus-visible:outline-public-orange-ink focus-visible:outline-offset-4"
            onClick={() => retry?.()}
            type="button"
          >
            Try again
          </button>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-public-ink/15 bg-public-surface px-6 font-semibold text-public-ink text-sm transition-colors hover:border-public-blue/40 hover:text-public-blue focus-visible:outline-2 focus-visible:outline-public-orange-ink focus-visible:outline-offset-4"
            href="/"
          >
            Back to Citius Holidays
          </Link>
        </div>
        {digest ? (
          <p className="mt-8 text-public-muted text-xs">
            Reference <span className="font-mono">{digest}</span>
          </p>
        ) : null}
      </section>
    </main>
  );
}
