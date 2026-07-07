"use client";

import { ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import AuthShell, { BRAND_NAME } from "@/components/auth/AuthShell";
import citiusConnectLogo from "@/static/logos/citiusconnect.png";

export default function EmailVerifiedPageClient() {
  return (
    <AuthShell
      description={`Your ${BRAND_NAME} account is one step away from secure access.`}
      logo={citiusConnectLogo}
      logoAlt="Citius Connect"
      showBrandLabel={false}
      title="Email verified"
    >
      <div className="space-y-6">
        <m.div
          animate={{ opacity: 1, scale: 1 }}
          className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm"
          initial={{ opacity: 0, scale: 0.96 }}
          transition={{ damping: 16, stiffness: 120, type: "spring" }}
        >
          <div className="border-emerald-100 border-b bg-emerald-50/80 px-6 py-5 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-emerald-500/25 shadow-lg">
              <ShieldCheck className="size-7" strokeWidth={2.25} />
            </div>
            <h3 className="font-heading font-medium text-2xl text-emerald-900">
              You&apos;re verified
            </h3>
          </div>

          <div className="space-y-4 px-6 py-5">
            <p className="text-[#0B1026]/70 text-sm leading-relaxed">
              Your email address is confirmed for {BRAND_NAME}. We&apos;ve sent a separate email
              with a link to set your password.
            </p>

            <div className="flex items-start gap-3 rounded-xl border border-[#e2e8f0] bg-[#FDFBF7] p-4">
              <div className="rounded-lg bg-[#d4af37]/15 p-2 text-[#b5952f]">
                <Mail className="size-5" />
              </div>
              <div>
                <p className="font-medium text-[#0B1026] text-sm">Check your inbox</p>
                <p className="mt-1 font-light text-[#64748b] text-sm leading-relaxed">
                  Open the password setup email from {BRAND_NAME}, then sign in to Citius Connect
                  once your password is set.
                </p>
              </div>
            </div>
          </div>
        </m.div>

        <Link
          className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#0B1026] p-4 font-medium text-lg text-white shadow-[#0B1026]/20 shadow-lg transition-all duration-300 hover:shadow-[#0B1026]/30 hover:shadow-xl"
          href="/auth/connect"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B1026] to-[#1a2c4e] opacity-100 transition-opacity group-hover:opacity-90" />
          <span className="relative z-10">Go to Citius Connect</span>
          <ArrowRight className="relative z-10 size-5 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </AuthShell>
  );
}
