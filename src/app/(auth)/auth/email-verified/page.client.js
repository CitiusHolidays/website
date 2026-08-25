"use client";

import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import AuthShell, { BRAND_NAME } from "@/components/auth/AuthShell";
import citiusConnectLogo from "@/static/logos/citiusconnect.png";

export default function EmailVerifiedPageClient() {
  return (
    <AuthShell
      description={`Your email address is confirmed for ${BRAND_NAME}.`}
      logo={citiusConnectLogo}
      logoAlt="Citius Connect"
      title="Email verified"
    >
      <div className="space-y-5">
        <div className="flex items-start gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
            <ShieldCheck aria-hidden="true" className="size-6" strokeWidth={2.25} />
          </div>
          <div>
            <p className="font-medium text-emerald-950">Set your password</p>
            <p className="mt-1 text-emerald-900/75 text-sm leading-6">
              Open the separate password email, then return to Citius Connect.
            </p>
          </div>
        </div>

        <Link
          className="group flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0B1026] px-4 py-3 font-medium text-lg text-white transition-[background-color,transform] duration-150 hover:bg-[#1a2c4e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-auth-accent-ink focus-visible:outline-offset-2 active:scale-[0.99]"
          href="/auth/connect"
        >
          <span>Go to Citius Connect</span>
          <ArrowRight
            aria-hidden="true"
            className="size-5 transition-transform fine-hover:group-hover:translate-x-1"
          />
        </Link>
      </div>
    </AuthShell>
  );
}
