"use client";

import { Map as MapIcon, Sparkles } from "lucide-react";
import { m as motion } from "motion/react";
import Image from "next/image";
import { CITIUS_CONNECT_LOGO_HEIGHT, CITIUS_CONNECT_LOGO_WIDTH } from "@/lib/citiusConnectLogo";
import citiusLogo from "@/static/logos/logo.webp";

export const BRAND_NAME = "Citius Holidays";
const CURRENT_YEAR = new Date().getFullYear();

export default function AuthShell({
  title,
  description,
  children,
  logo = citiusLogo,
  logoAlt = BRAND_NAME,
  showBrandLabel = true,
  logoWidth = 100,
  logoHeight = 100,
}) {
  const logoDimensions = showBrandLabel
    ? { width: logoWidth, height: logoHeight }
    : {
        width: CITIUS_CONNECT_LOGO_WIDTH,
        height: CITIUS_CONNECT_LOGO_HEIGHT,
      };
  return (
    <div className="flex min-h-screen w-full flex-col bg-[#FDFBF7] md:flex-row">
      <motion.aside
        className="relative hidden w-full flex-col justify-between overflow-hidden bg-[#0B1026] p-12 text-[#FDFBF7] md:flex md:w-1/2 lg:w-5/12"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-[#1a2c4e] via-[#0B1026] to-[#050814] opacity-80" />
          <div className="absolute bottom-[-20%] left-[-20%] size-[800px] rounded-full bg-[#1e293b] opacity-10 blur-3xl" />
          <div className="absolute top-[20%] right-[-10%] size-[400px] rounded-full bg-[#d4af37] opacity-5 blur-[100px]" />
          <div
            className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay"
            aria-hidden
          />
        </div>

        <div className="relative z-10 flex h-full flex-col justify-between">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="mb-2 flex items-center gap-3">
              <Image
                src={logo}
                alt={logoAlt}
                width={logoDimensions.width}
                height={logoDimensions.height}
                className={showBrandLabel ? "h-14 w-auto" : "h-12 w-auto max-w-[220px]"}
              />
              {showBrandLabel ? (
                <span className="text-sm uppercase tracking-[0.2em] text-citius-orange">
                  {BRAND_NAME}
                </span>
              ) : null}
            </div>
            <h1 className="font-heading mt-6 text-5xl font-medium leading-[1.1] tracking-tight lg:text-6xl">
              The Journey <br />
              <span className="italic text-citius-orange">Within</span> Begins <br />
              Here.
            </h1>
          </motion.div>

          <motion.div
            className="my-10 space-y-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <div className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="rounded-lg bg-[#d4af37]/20 p-2 text-[#d4af37]">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h3 className="font-heading mb-1 text-lg font-medium text-white">
                  Curated Pilgrimages
                </h3>
                <p className="text-sm font-light leading-relaxed text-white/60">
                  Discover destinations that speak to your soul, from the peaks of Kailash to the
                  temples of Kyoto.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="rounded-lg bg-[#d4af37]/20 p-2 text-[#d4af37]">
                <MapIcon className="size-5" />
              </div>
              <div>
                <h3 className="font-heading mb-1 text-lg font-medium text-white">
                  Seamless Exploration
                </h3>
                <p className="text-sm font-light leading-relaxed text-white/60">
                  Let us handle the details while you focus on the experience. Expert guides, luxury
                  stays, peace of mind.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="rounded-lg bg-[#d4af37]/20 p-2 text-[#d4af37]">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h3 className="font-heading mb-1 text-lg font-medium text-white">Citius Connect</h3>
                <p className="text-sm font-light leading-relaxed text-white/60">
                  Access the {BRAND_NAME} CRM to manage enquiries, proposals, and job cards.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-xs font-light text-white/30"
          >
            © {CURRENT_YEAR} {BRAND_NAME}. All rights reserved.
          </motion.p>
        </div>
      </motion.aside>

      <div className="relative flex w-full items-center justify-center p-6 md:w-1/2 md:p-12 lg:w-7/12">
        <motion.div
          className="relative z-10 w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8 text-center md:hidden">
            <div className="mb-4 flex items-center justify-center">
              <Image
                src={logo}
                alt={logoAlt}
                width={logoDimensions.width}
                height={logoDimensions.height}
                className={showBrandLabel ? "h-10 w-auto" : "h-10 w-auto max-w-[180px]"}
              />
            </div>
          </div>

          <div className="mb-6 hidden items-center gap-3 md:flex">
            <Image
              src={logo}
              alt={logoAlt}
              width={logoDimensions.width}
              height={logoDimensions.height}
              className={showBrandLabel ? "h-10 w-auto" : "h-10 w-auto max-w-[180px]"}
            />
          </div>

          <motion.div className="mb-8">
            <h2 className="font-heading mb-3 text-4xl text-[#0B1026] md:text-5xl">{title}</h2>
            {description ? (
              <p className="text-lg font-light text-[#0B1026]/60">{description}</p>
            ) : null}
          </motion.div>

          {children}
        </motion.div>
      </div>
    </div>
  );
}
