import Link from "next/link";

export default function BlogPostLoadingShell() {
  return (
    <section aria-label="Loading article" className="min-h-screen bg-public-paper" role="status">
      <div className="bg-public-night px-5 pt-28 pb-8 text-white sm:px-8 sm:pt-32 sm:pb-12">
        <div className="mx-auto max-w-4xl">
          <Link
            className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
            href="/blog"
          >
            Back to Journal
          </Link>
          <p className="mt-5 font-heading text-3xl">Loading article…</p>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="mx-auto max-w-3xl animate-pulse space-y-5 px-5 py-10 motion-reduce:animate-none sm:px-8"
      >
        <div className="h-5 w-full rounded bg-public-ink/10" />
        <div className="h-5 w-full rounded bg-public-ink/10" />
        <div className="h-5 w-3/4 rounded bg-public-ink/10" />
      </div>
    </section>
  );
}
