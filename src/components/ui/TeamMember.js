"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import Image from "next/image";
import { useState } from "react";

export default function TeamMember({ member, index }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const collapsedHeight = "60px";

  return (
    <m.div
      className="group overflow-hidden rounded-xl bg-white shadow-lg transition-shadow duration-300 hover:shadow-2xl"
      initial={{ opacity: 0, y: 30 }}
      transition={{
        delay: index * 0.1,
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
      }}
      viewport={{ amount: 0.3, once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <div className="relative h-80 bg-gradient-to-br from-citius-blue to-citius-orange">
        {member.image ? (
          <Image
            alt={member.name}
            className="object-cover object-center"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
            src={member.image}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="flex size-32 items-center justify-center rounded-full bg-white/20">
              <span className="font-bold text-4xl text-brand-light">
                {member.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="p-6">
        <m.h3
          animate={{ opacity: 1 }}
          className={`${
            member.name.length > 16 ? "text-lg" : "text-xl"
          } mb-1 font-bold text-brand-dark`}
          initial={{ opacity: 0 }}
          transition={{ delay: index * 0.1 + 0.3 }}
        >
          {member.name}
        </m.h3>
        <m.p
          animate={{ opacity: 1 }}
          className="mb-4 font-medium text-citius-orange"
          initial={{ opacity: 0 }}
          transition={{ delay: index * 0.1 + 0.4 }}
        >
          {member.position}
        </m.p>

        <div className="relative">
          <m.div
            animate={{ height: isExpanded ? "auto" : collapsedHeight }}
            className="relative overflow-hidden"
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-brand-muted text-sm leading-relaxed">{member.bio}</p>
          </m.div>

          {member.bio.length > 200 && (
            <m.button
              className="mt-3 flex items-center gap-1 font-medium text-citius-blue text-sm transition-colors hover:text-citius-orange"
              onClick={() => setIsExpanded(!isExpanded)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span>{isExpanded ? "Show Less" : "Read More"}</span>
              <m.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.3 }}>
                <ChevronDown className="size-4" />
              </m.div>
            </m.button>
          )}
        </div>

        <AnimatePresence>
          {isExpanded && member.quote && (
            <m.div
              animate={{ height: "auto", opacity: 1, y: 0 }}
              className="mt-4 overflow-hidden border-brand-border border-t pt-4"
              exit={{ height: 0, opacity: 0, y: 10 }}
              initial={{ height: 0, opacity: 0, y: 10 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-brand-muted text-sm italic">&quot;{member.quote}&quot;</p>
              {member.quoteAuthor && (
                <p className="mt-1 text-brand-muted text-xs">- {member.quoteAuthor}</p>
              )}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </m.div>
  );
}
