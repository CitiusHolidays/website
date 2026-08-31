"use client";

import AuthShell from "./AuthShell";

function ErrorActions({ loginHref, reset }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        className="inline-flex min-h-12 flex-1 items-center justify-center rounded-lg bg-[#0B1026] px-6 font-medium text-sm text-white transition-colors hover:bg-[#1a2c4e] focus-visible:outline-2 focus-visible:outline-auth-accent-ink focus-visible:outline-offset-2"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
      {loginHref ? (
        <a
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-lg border border-[#0B1026]/15 bg-white px-6 font-medium text-[#0B1026] text-sm transition-colors hover:bg-[#f8f6f1] focus-visible:outline-2 focus-visible:outline-auth-accent-ink focus-visible:outline-offset-2"
          href={loginHref}
        >
          Return to sign in
        </a>
      ) : null}
    </div>
  );
}

export default function PrivateAuthError({ loginHref, reset, scenic = false }) {
  if (scenic) {
    return (
      <AuthShell
        description="The secure connection was interrupted. Try again and we’ll re-check your access without changing your account."
        title="We couldn’t verify your session"
      >
        <ErrorActions loginHref={loginHref} reset={reset} />
      </AuthShell>
    );
  }

  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-[#f8f6f1] px-6 py-16">
      <section
        aria-labelledby="private-auth-error-title"
        className="w-full max-w-lg rounded-2xl border border-[#e7e0d5] bg-white p-8 text-center shadow-[0_20px_60px_rgba(6,35,65,0.08)]"
      >
        <h1
          className="font-heading text-3xl text-[#062341] tracking-tight"
          id="private-auth-error-title"
        >
          We could not verify your session
        </h1>
        <p className="mt-4 font-sans text-[#5f6877] text-sm leading-6">
          The secure connection was interrupted. Try again, and we will re-check your access without
          changing your account.
        </p>
        <div className="mt-7">
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#062341] px-6 font-medium font-sans text-sm text-white transition-colors hover:bg-[#0b3156] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-auth-accent-ink focus-visible:ring-offset-2"
              onClick={reset}
              type="button"
            >
              Try again
            </button>
            {loginHref ? (
              <a
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#d9d0c3] px-6 font-medium font-sans text-[#062341] text-sm transition-colors hover:bg-[#f8f6f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-auth-accent-ink focus-visible:ring-offset-2"
                href={loginHref}
              >
                Return to sign in
              </a>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
