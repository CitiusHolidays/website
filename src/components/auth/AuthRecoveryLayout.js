"use client";

import { Compass, Map as MapIcon, Shield, Sparkles } from "lucide-react";
import { m } from "motion/react";

const BRAND_NAME = "Citius Holidays";
const CURRENT_YEAR = new Date().getFullYear();

export default function AuthRecoveryLayout({
  panelHeading,
  panelSubtext,
  formTitle,
  formDescription,
  children,
}) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-[#FDFBF7] md:flex-row">
      <m.aside
        animate={{ opacity: 1, x: 0 }}
        className="relative hidden w-full flex-col overflow-hidden bg-[#0B1026] p-12 text-[#FDFBF7] md:flex md:w-1/2 lg:w-5/12"
        initial={{ opacity: 0, x: -50 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-[#1a2c4e] via-[#0B1026] to-[#050814] opacity-90" />
          <m.div
            aria-hidden
            className="absolute inset-0 bg-[url('/gallery/bgmice.webp')] bg-center bg-cover opacity-[0.18] mix-blend-overlay"
          />
          <div className="absolute bottom-[-20%] left-[-20%] size-[800px] rounded-full bg-[#1e293b] opacity-10 blur-3xl" />
          <div className="absolute top-[20%] right-[-10%] size-[400px] rounded-full bg-[#d4af37] opacity-5 blur-[100px]" />
          <m.div
            aria-hidden
            className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay"
          />
        </div>

        <div className="relative z-10 flex h-full flex-col justify-between">
          <m.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.35 }}
          >
            <div className="mb-2 flex items-center gap-3">
              <Compass className="size-6 text-[#d4af37]" />
              <span className="text-[#d4af37] text-sm uppercase tracking-[0.2em]">
                {BRAND_NAME}
              </span>
            </div>
            <h1 className="mt-6 font-heading font-medium text-5xl leading-[1.1] tracking-tight lg:text-6xl">
              {panelHeading}
            </h1>
            {panelSubtext ? (
              <p className="mt-5 max-w-md font-light text-sm text-white/60 leading-relaxed">
                {panelSubtext}
              </p>
            ) : null}
          </m.div>

          <m.div
            animate={{ opacity: 1 }}
            className="my-10 space-y-6"
            initial={{ opacity: 0 }}
            transition={{ delay: 0.55 }}
          >
            <div className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="rounded-lg bg-[#d4af37]/20 p-2 text-[#d4af37]">
                <Shield className="size-5" />
              </div>
              <div>
                <h3 className="mb-1 font-heading font-medium text-lg text-white">Secure access</h3>
                <p className="font-light text-sm text-white/60 leading-relaxed">
                  Your account stays protected with encrypted sign-in and verified recovery links.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="rounded-lg bg-[#d4af37]/20 p-2 text-[#d4af37]">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h3 className="mb-1 font-heading font-medium text-lg text-white">
                  Curated journeys
                </h3>
                <p className="font-light text-sm text-white/60 leading-relaxed">
                  Pilgrimages and bespoke travel, crafted by the {BRAND_NAME} team you already
                  trust.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="rounded-lg bg-[#d4af37]/20 p-2 text-[#d4af37]">
                <MapIcon className="size-5" />
              </div>
              <div>
                <h3 className="mb-1 font-heading font-medium text-lg text-white">
                  Seamless support
                </h3>
                <p className="font-light text-sm text-white/60 leading-relaxed">
                  Questions about your trip or account? Our team is only a message away.
                </p>
              </div>
            </div>
          </m.div>

          <m.p
            animate={{ opacity: 1 }}
            className="font-light text-white/30 text-xs"
            initial={{ opacity: 0 }}
            transition={{ delay: 0.75 }}
          >
            © {CURRENT_YEAR} {BRAND_NAME}. All rights reserved.
          </m.p>
        </div>
      </m.aside>

      <div className="relative flex w-full items-center justify-center overflow-hidden p-6 md:w-1/2 md:p-12 lg:w-7/12">
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[#FDFBF7]" />
          <div className="absolute inset-0 bg-[url('/gallery/bgaboutus.webp')] bg-center bg-cover opacity-[0.14] mix-blend-multiply" />
          <div className="absolute inset-0 bg-[url('/gallery/bgfooter.webp')] bg-center bg-cover opacity-[0.1]" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#FDFBF7]/92 via-[#FDFBF7]/88 to-[#FDFBF7]/95" />
        </div>

        <m.div
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md"
          initial={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.45 }}
        >
          <div className="mb-8">
            <h2 className="mb-3 font-heading text-4xl text-[#0B1026] md:text-5xl">{formTitle}</h2>
            {formDescription ? (
              <p className="font-light text-[#0B1026]/60 text-lg">{formDescription}</p>
            ) : null}
          </div>

          {children}
        </m.div>
      </div>
    </div>
  );
}
