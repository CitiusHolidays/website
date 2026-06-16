"use client";

import { m } from "motion/react";
import { Map as MapIcon, Sparkles } from "lucide-react";
import Image from "next/image";
import { CITIUS_CONNECT_LOGO_HEIGHT, CITIUS_CONNECT_LOGO_WIDTH } from "@/lib/citiusConnectLogo";

const HIGHLIGHT_ICONS = [Sparkles, MapIcon, Sparkles];
const AUTH_COPYRIGHT_YEAR = 2026;

export function AuthLoginHero({ copy, brandLogo, brandLogoAlt, isConnect }) {
  const heroLines = copy.heroLines ?? [];

  return (
    <m.div
      className="relative hidden md:flex w-full md:w-1/2 lg:w-5/12 bg-[#0B1026] text-[#FDFBF7] overflow-hidden flex-col justify-between p-12"
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 size-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-[#1a2c4e] via-[#0B1026] to-[#050814] opacity-80"></div>
        <div className="absolute bottom-[-20%] left-[-20%] size-[800px] rounded-full bg-[#1e293b] opacity-10 blur-3xl"></div>
        <div className="absolute top-[20%] right-[-10%] size-[400px] rounded-full bg-[#d4af37] opacity-5 blur-[100px]"></div>
        <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay bg-[url('/noise.svg')]"></div>
      </div>

      <div className="relative z-10 h-full flex flex-col justify-between">
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Image
              src={brandLogo}
              alt={brandLogoAlt}
              width={isConnect ? CITIUS_CONNECT_LOGO_WIDTH : 100}
              height={isConnect ? CITIUS_CONNECT_LOGO_HEIGHT : 100}
              className={isConnect ? "h-12 w-auto max-w-[220px]" : "h-14 w-auto"}
            />
            {!isConnect ? (
              <span className="text-sm uppercase tracking-[0.2em] text-citius-orange">
                {copy.brandLabel}
              </span>
            ) : null}
          </div>
          <h1 className="font-heading text-5xl lg:text-6xl leading-[1.1] font-medium tracking-tight mt-6">
            {heroLines.map((line, index) => (
              <span key={typeof line === "string" ? line : `${line.highlight}-${line.rest}`}>
                {typeof line === "string" ? (
                  line
                ) : (
                  <>
                    <span className="italic text-citius-orange">{line.highlight}</span>
                    {line.rest}
                  </>
                )}
                {index < heroLines.length - 1 && <br />}
              </span>
            ))}
          </h1>
        </m.div>

        <m.div
          className="space-y-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          {copy.highlights.map((highlight, index) => {
            const Icon = HIGHLIGHT_ICONS[index] ?? Sparkles;
            return (
              <div
                key={highlight.title}
                className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
              >
                <div className="p-2 rounded-lg bg-[#d4af37]/20 text-[#d4af37]">
                  <Icon className="size-5" />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-medium text-white mb-1">
                    {highlight.title}
                  </h3>
                  <p className="text-white/60 text-sm font-light leading-relaxed">
                    {highlight.description}
                  </p>
                </div>
              </div>
            );
          })}
        </m.div>

        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-xs text-white/30 font-light"
        >
          © {AUTH_COPYRIGHT_YEAR} Citius Holidays. All rights reserved.
        </m.div>
      </div>
    </m.div>
  );
}
