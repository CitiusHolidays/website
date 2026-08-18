"use client";

import { Map as MapIcon, Sparkles } from "lucide-react";
import { m } from "motion/react";
import Image from "next/image";
import { CITIUS_CONNECT_LOGO_HEIGHT, CITIUS_CONNECT_LOGO_WIDTH } from "@/lib/citiusConnectLogo";
import citiusLogo from "@/static/logos/logo.webp";
import { AuthFeatureList } from "./AuthFeatureList";

export const BRAND_NAME = "Citius Holidays";
const AUTH_SHELL_FEATURES = [
  {
    description:
      "Discover destinations that speak to your soul, from the peaks of Kailash to the temples of Kyoto.",
    icon: Sparkles,
    title: "Curated Pilgrimages",
  },
  {
    description:
      "Expert guides, considered stays, and trip details coordinated by the Citius team.",
    icon: MapIcon,
    title: "Expert trip planning",
  },
  {
    description: `Access the ${BRAND_NAME} CRM to manage enquiries, proposals, and job cards.`,
    icon: Sparkles,
    title: "Citius Connect",
  },
];

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
  const currentYear = new Date().getFullYear();
  const logoDimensions = showBrandLabel
    ? { height: logoHeight, width: logoWidth }
    : {
        height: CITIUS_CONNECT_LOGO_HEIGHT,
        width: CITIUS_CONNECT_LOGO_WIDTH,
      };
  return (
    <div className="flex min-h-screen w-full flex-col bg-[#FDFBF7] md:flex-row">
      <m.aside
        animate={{ opacity: 1, x: 0 }}
        className="material-structural relative hidden w-full flex-col justify-between overflow-hidden bg-[#0B1026] p-12 text-[#FDFBF7] md:flex md:w-1/2 lg:w-5/12"
        initial={{ opacity: 0, x: -50 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-[#1a2c4e] via-[#0B1026] to-[#050814] opacity-80" />
          <div className="absolute bottom-[-20%] left-[-20%] size-[800px] rounded-full bg-[#1e293b] opacity-10 blur-3xl" />
          <div className="absolute top-[20%] right-[-10%] size-[400px] rounded-full bg-auth-accent-on-dark opacity-5 blur-[100px]" />
          <div
            aria-hidden
            className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay"
          />
        </div>

        <div className="relative z-10 flex h-full flex-col justify-between">
          <m.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.4 }}
          >
            <div className="mb-2 flex items-center gap-3">
              <Image
                alt={logoAlt}
                className={showBrandLabel ? "h-14 w-auto" : "h-12 w-auto max-w-[220px]"}
                height={logoDimensions.height}
                src={logo}
                width={logoDimensions.width}
              />
              {showBrandLabel ? (
                <span className="text-auth-accent-on-dark text-sm uppercase tracking-[0.2em]">
                  {BRAND_NAME}
                </span>
              ) : null}
            </div>
            <h1 className="mt-6 font-heading font-medium text-5xl leading-[1.1] tracking-tight lg:text-6xl">
              The Journey <br />
              <span className="text-auth-accent-on-dark italic">Within</span> Begins <br />
              Here.
            </h1>
          </m.div>

          <m.div
            animate={{ opacity: 1 }}
            className="my-10"
            initial={{ opacity: 0 }}
            transition={{ delay: 0.6 }}
          >
            <AuthFeatureList items={AUTH_SHELL_FEATURES} />
          </m.div>

          <m.p
            animate={{ opacity: 1 }}
            className="font-normal text-brand-muted-on-dark text-xs"
            initial={{ opacity: 0 }}
            transition={{ delay: 0.8 }}
          >
            © {currentYear} {BRAND_NAME}. All rights reserved.
          </m.p>
        </div>
      </m.aside>

      <div className="relative flex w-full items-center justify-center p-6 md:w-1/2 md:p-12 lg:w-7/12">
        <m.div
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8 text-center md:hidden">
            <div className="mb-4 flex items-center justify-center">
              <Image
                alt={logoAlt}
                className={showBrandLabel ? "h-10 w-auto" : "h-10 w-auto max-w-[180px]"}
                height={logoDimensions.height}
                src={logo}
                width={logoDimensions.width}
              />
            </div>
          </div>

          <div className="mb-6 hidden items-center gap-3 md:flex">
            <Image
              alt={logoAlt}
              className={showBrandLabel ? "h-10 w-auto" : "h-10 w-auto max-w-[180px]"}
              height={logoDimensions.height}
              src={logo}
              width={logoDimensions.width}
            />
          </div>

          <m.div className="mb-8">
            <h2 className="mb-3 font-heading text-4xl text-[#0B1026] md:text-5xl">{title}</h2>
            {description ? (
              <p className="font-normal text-[#0B1026]/70 text-lg">{description}</p>
            ) : null}
          </m.div>

          {children}
        </m.div>
      </div>
    </div>
  );
}
