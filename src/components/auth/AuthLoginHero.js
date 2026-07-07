"use client";

import { Map as MapIcon, Sparkles } from "lucide-react";
import { m } from "motion/react";
import Image from "next/image";
import { CITIUS_CONNECT_LOGO_HEIGHT, CITIUS_CONNECT_LOGO_WIDTH } from "@/lib/citiusConnectLogo";

const HIGHLIGHT_ICONS = [Sparkles, MapIcon, Sparkles];
const AUTH_COPYRIGHT_YEAR = 2026;

export function AuthLoginHero({ copy, brandLogo, brandLogoAlt, isConnect }) {
  const heroLines = copy.heroLines ?? [];

  return (
    <m.div
      animate={{ opacity: 1, x: 0 }}
      className="relative hidden w-full flex-col justify-between overflow-hidden bg-[#0B1026] p-12 text-[#FDFBF7] md:flex md:w-1/2 lg:w-5/12"
      initial={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 size-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-[#1a2c4e] via-[#0B1026] to-[#050814] opacity-80" />
        <div className="absolute bottom-[-20%] left-[-20%] size-[800px] rounded-full bg-[#1e293b] opacity-10 blur-3xl" />
        <div className="absolute top-[20%] right-[-10%] size-[400px] rounded-full bg-[#d4af37] opacity-5 blur-[100px]" />
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <div className="relative z-10 flex h-full flex-col justify-between">
        <m.div
          animate={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.4 }}
        >
          <div className="mb-2 flex items-center gap-3">
            <Image
              alt={brandLogoAlt}
              className={isConnect ? "h-12 w-auto max-w-[220px]" : "h-14 w-auto"}
              height={isConnect ? CITIUS_CONNECT_LOGO_HEIGHT : 100}
              src={brandLogo}
              width={isConnect ? CITIUS_CONNECT_LOGO_WIDTH : 100}
            />
            {isConnect ? null : (
              <span className="text-citius-orange text-sm uppercase tracking-[0.2em]">
                {copy.brandLabel}
              </span>
            )}
          </div>
          <h1 className="mt-6 font-heading font-medium text-5xl leading-[1.1] tracking-tight lg:text-6xl">
            {heroLines.map((line, index) => (
              <span key={typeof line === "string" ? line : `${line.highlight}-${line.rest}`}>
                {typeof line === "string" ? (
                  line
                ) : (
                  <>
                    <span className="text-citius-orange italic">{line.highlight}</span>
                    {line.rest}
                  </>
                )}
                {index < heroLines.length - 1 && <br />}
              </span>
            ))}
          </h1>
        </m.div>

        <m.div
          animate={{ opacity: 1 }}
          className="space-y-8"
          initial={{ opacity: 0 }}
          transition={{ delay: 0.6 }}
        >
          {copy.highlights.map((highlight, index) => {
            const Icon = HIGHLIGHT_ICONS[index] ?? Sparkles;
            return (
              <div
                className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
                key={highlight.title}
              >
                <div className="rounded-lg bg-[#d4af37]/20 p-2 text-[#d4af37]">
                  <Icon className="size-5" />
                </div>
                <div>
                  <h3 className="mb-1 font-heading font-medium text-lg text-white">
                    {highlight.title}
                  </h3>
                  <p className="font-light text-sm text-white/60 leading-relaxed">
                    {highlight.description}
                  </p>
                </div>
              </div>
            );
          })}
        </m.div>

        <m.div
          animate={{ opacity: 1 }}
          className="font-light text-white/30 text-xs"
          initial={{ opacity: 0 }}
          transition={{ delay: 0.8 }}
        >
          © {AUTH_COPYRIGHT_YEAR} Citius Holidays. All rights reserved.
        </m.div>
      </div>
    </m.div>
  );
}
