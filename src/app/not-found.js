import Link from "next/link";

export const metadata = {
  description: "The page you requested could not be found on Citius Holidays.",
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-brand-light px-4 py-16 text-center">
      <p className="font-heading font-semibold text-citius-blue text-sm uppercase tracking-[0.2em]">
        404
      </p>
      <h1 className="mt-3 font-heading font-semibold text-3xl text-brand-dark md:text-4xl">
        Page not found
      </h1>
      <p className="mt-4 max-w-md text-brand-muted leading-relaxed">
        The page you are looking for may have moved, expired, or never existed. Return to the public
        site or sign in to Citius Connect.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          className="inline-flex min-h-11 items-center rounded-full bg-citius-blue px-6 font-medium text-sm text-white transition-colors hover:bg-citius-blue/90"
          href="/"
        >
          Citius Holidays
        </Link>
        <Link
          className="inline-flex min-h-11 items-center rounded-full border border-brand-border bg-white px-6 font-medium text-brand-dark text-sm transition-colors hover:border-citius-blue/30 hover:text-citius-blue"
          href="/auth/connect"
        >
          Citius Connect
        </Link>
      </div>
    </div>
  );
}
