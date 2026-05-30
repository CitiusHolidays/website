"use client";

import { Compass, Map as MapIcon, Shield, Sparkles } from "lucide-react";
import { motion } from "motion/react";

export const BRAND_NAME = "Citius Holidays";

export default function AuthRecoveryLayout({
  panelHeading,
  panelSubtext,
  formTitle,
  formDescription,
  children,
}) {
  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#FDFBF7]">
      <motion.aside
        className="relative hidden md:flex w-full md:w-1/2 lg:w-5/12 flex-col overflow-hidden bg-[#0B1026] p-12 text-[#FDFBF7]"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-[#1a2c4e] via-[#0B1026] to-[#050814] opacity-90" />
          <motion.div
            className="absolute inset-0 bg-[url('/gallery/bgmice.webp')] bg-cover bg-center opacity-[0.18] mix-blend-overlay"
            aria-hidden
          />
          <div className="absolute bottom-[-20%] left-[-20%] h-[800px] w-[800px] rounded-full bg-[#1e293b] opacity-10 blur-3xl" />
          <div className="absolute top-[20%] right-[-10%] h-[400px] w-[400px] rounded-full bg-[#d4af37] opacity-5 blur-[100px]" />
          <motion.div
            className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay"
            aria-hidden
          />
        </div>

        <div className="relative z-10 flex h-full flex-col justify-between">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <div className="mb-2 flex items-center gap-3">
              <Compass className="h-6 w-6 text-[#d4af37]" />
              <span className="text-sm uppercase tracking-[0.2em] text-[#d4af37]">
                {BRAND_NAME}
              </span>
            </div>
            <h1 className="font-heading mt-6 text-5xl font-medium leading-[1.1] tracking-tight lg:text-6xl">
              {panelHeading}
            </h1>
            {panelSubtext ? (
              <p className="mt-5 max-w-md text-sm font-light leading-relaxed text-white/60">
                {panelSubtext}
              </p>
            ) : null}
          </motion.div>

          <motion.div
            className="my-10 space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
          >
            <div className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="rounded-lg bg-[#d4af37]/20 p-2 text-[#d4af37]">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-heading mb-1 text-lg font-medium text-white">Secure access</h3>
                <p className="text-sm font-light leading-relaxed text-white/60">
                  Your account stays protected with encrypted sign-in and verified recovery links.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="rounded-lg bg-[#d4af37]/20 p-2 text-[#d4af37]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-heading mb-1 text-lg font-medium text-white">
                  Curated journeys
                </h3>
                <p className="text-sm font-light leading-relaxed text-white/60">
                  Pilgrimages and bespoke travel, crafted by the {BRAND_NAME} team you already
                  trust.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="rounded-lg bg-[#d4af37]/20 p-2 text-[#d4af37]">
                <MapIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-heading mb-1 text-lg font-medium text-white">
                  Seamless support
                </h3>
                <p className="text-sm font-light leading-relaxed text-white/60">
                  Questions about your trip or account? Our team is only a message away.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.75 }}
            className="text-xs font-light text-white/30"
          >
            © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
          </motion.p>
        </div>
      </motion.aside>

      <div className="relative flex w-full md:w-1/2 lg:w-7/12 items-center justify-center overflow-hidden p-6 md:p-12">
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
          <div className="absolute inset-0 bg-[#FDFBF7]" />
          <div className="absolute inset-0 bg-[url('/gallery/bgaboutus.webp')] bg-cover bg-center opacity-[0.14] mix-blend-multiply" />
          <div className="absolute inset-0 bg-[url('/gallery/bgfooter.webp')] bg-cover bg-center opacity-[0.1]" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#FDFBF7]/92 via-[#FDFBF7]/88 to-[#FDFBF7]/95" />
        </div>

        <motion.div
          className="relative z-10 w-full max-w-md"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="mb-8">
            <h2 className="font-heading mb-3 text-4xl text-[#0B1026] md:text-5xl">{formTitle}</h2>
            {formDescription ? (
              <p className="text-lg font-light text-[#0B1026]/60">{formDescription}</p>
            ) : null}
          </div>

          {children}
        </motion.div>
      </div>
    </div>
  );
}
