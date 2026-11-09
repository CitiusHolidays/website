"use client";

import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import AuthShell, { BRAND_NAME } from "@/components/auth/AuthShell";
import citiusConnectLogo from "@/static/logos/citiusconnect.png";

const PRIMARY_ACTION_CLASS =
  "group flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0B1026] px-4 py-3 font-medium text-lg text-white transition-[background-color,transform] duration-150 hover:bg-[#1a2c4e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-auth-accent-ink focus-visible:outline-offset-2 active:scale-[0.99]";

// Verification emails carry `?from=`: staff invitations use Citius Connect copy (also the default,
// for links sent before `from` existed); traveller verification uses Travel Account copy.
const AUDIENCES = {
  guest: {
    action: { href: "/auth/guest", label: "Sign in" },
    expired:
      "Verification links work once and expire. Sign in with your email and password and we’ll send you a fresh link.",
    logo: undefined,
    logoAlt: undefined,
    next: {
      body: "Sign in with your email and password to open your Travel Account.",
      title: "You can sign in now",
    },
    verified: `Your email address is confirmed for ${BRAND_NAME}.`,
  },
  staff: {
    action: { href: "/auth/connect", label: "Go to Citius Connect" },
    expired:
      "Verification links work once and expire. Ask your Citius Connect administrator to send you a new invitation.",
    logo: citiusConnectLogo,
    logoAlt: "Citius Connect",
    next: {
      body: "Open the separate password email, then return to Citius Connect.",
      title: "Set your password",
    },
    verified: `Your email address is confirmed for ${BRAND_NAME}.`,
  },
};

function EmailVerifiedContent() {
  const searchParams = useSearchParams();
  const audience = AUDIENCES[searchParams.get("from") === "guest" ? "guest" : "staff"];
  // Better Auth redirects here with `?error=` when the link is expired, used or invalid.
  const failed = Boolean(searchParams.get("error"));

  return (
    <AuthShell
      description={failed ? audience.expired : audience.verified}
      logo={audience.logo}
      logoAlt={audience.logoAlt}
      title={failed ? "This link has expired" : "Email verified"}
    >
      <div className="space-y-5">
        {failed ? null : (
          <div className="flex items-start gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <ShieldCheck aria-hidden="true" className="size-6" strokeWidth={2.25} />
            </div>
            <div>
              <p className="font-medium text-emerald-950">{audience.next.title}</p>
              <p className="mt-1 text-emerald-900/75 text-sm leading-6">{audience.next.body}</p>
            </div>
          </div>
        )}

        <Link className={PRIMARY_ACTION_CLASS} href={audience.action.href}>
          <span>{audience.action.label}</span>
          <ArrowRight
            aria-hidden="true"
            className="size-5 transition-transform fine-hover:group-hover:translate-x-1"
          />
        </Link>
      </div>
    </AuthShell>
  );
}

export default function EmailVerifiedPageClient() {
  return (
    <Suspense fallback={<AuthShell title="Checking your link" />}>
      <EmailVerifiedContent />
    </Suspense>
  );
}
