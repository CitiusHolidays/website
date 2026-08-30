import Image from "next/image";
import Link from "next/link";
import citiusLogo from "@/static/logos/logo.webp";

export const BRAND_NAME = "Citius Holidays";

export default function AuthShell({
  title,
  description,
  children,
  logo = citiusLogo,
  logoAlt = BRAND_NAME,
}) {
  return (
    <div className="relative isolate min-h-dvh overflow-hidden bg-[#0B1026]">
      <div aria-hidden="true" className="auth-artwork absolute inset-0 -z-20 bg-center bg-cover" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(11,16,38,0.16),rgba(11,16,38,0.52))]"
      />

      <div className="flex min-h-dvh items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <section className="material-structural w-full max-w-[30rem] rounded-[1.75rem] border border-white/50 bg-[#FDFBF7]/95 p-6 text-[#0B1026] shadow-[0_28px_90px_rgba(5,8,20,0.32)] backdrop-blur-sm [--material-preference-background:#FDFBF7] [--material-preference-boundary:#0B1026] sm:p-7">
          <header className="flex items-center justify-between gap-4">
            <Link
              aria-label="Back to Citius Holidays"
              className="inline-flex min-h-11 items-center rounded-md focus-visible:outline-2 focus-visible:outline-citius-orange focus-visible:outline-offset-4"
              href="/"
            >
              <Image alt={logoAlt} className="h-10 w-auto max-w-52 object-contain" src={logo} />
            </Link>
            <Link
              className="inline-flex min-h-11 shrink-0 items-center rounded-sm font-medium text-[#0B1026] text-xs underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-citius-orange focus-visible:outline-offset-2"
              href="/"
            >
              ← Back to website
            </Link>
          </header>

          {title ? (
            <div className="mt-7">
              <h1 className="text-balance font-heading font-semibold text-3xl tracking-tight sm:text-4xl">
                {title}
              </h1>
              {description ? (
                <p className="mt-3 max-w-[42ch] text-[#0B1026]/70 leading-7">{description}</p>
              ) : null}
            </div>
          ) : null}

          <div className={title ? "mt-7" : "mt-6"}>{children}</div>
        </section>
      </div>
    </div>
  );
}
