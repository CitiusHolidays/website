"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function buildWordLines(lines) {
  const rows = [];
  let index = 0;
  for (const line of lines) {
    const row = [];
    for (const word of line.split(" ")) {
      row.push({ index, word });
      index += 1;
    }
    rows.push(row);
  }
  return rows;
}

export default function PublicTaglineReveal({ className, lines }) {
  const shouldReduceMotion = useReducedMotion();
  const wordLines = useMemo(() => buildWordLines(lines), [lines]);
  const wordCount = wordLines.reduce((total, line) => total + line.length, 0);
  const [activeCount, setActiveCount] = useState(0);
  const wordRefs = useRef([]);

  useEffect(() => {
    if (shouldReduceMotion || wordCount === 0) {
      return;
    }

    if (!("IntersectionObserver" in globalThis)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }
          const index = Number(entry.target.getAttribute("data-word-index"));
          if (Number.isFinite(index)) {
            setActiveCount((current) => Math.max(current, index + 1));
          }
        }
      },
      { rootMargin: "-42% 0px -42% 0px", threshold: 0.01 }
    );

    for (const node of wordRefs.current) {
      if (node) {
        observer.observe(node);
      }
    }

    return () => observer.disconnect();
  }, [shouldReduceMotion, wordCount]);

  return (
    <p
      className={cn(
        "max-w-[680px] text-balance font-heading font-semibold text-4xl leading-tight md:text-5xl lg:text-6xl",
        className
      )}
    >
      {wordLines.map((lineWords, lineIndex) => (
        <span className="block" key={lines[lineIndex] ?? `line-${lineIndex}`}>
          {lineWords.map((entry, wordIndex) => {
            const active = shouldReduceMotion === true || entry.index < activeCount;
            return (
              <span
                className={cn(
                  "inline transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
                  active ? "text-public-ink" : "text-public-ink/30"
                )}
                data-word-index={entry.index}
                key={`${entry.index}-${entry.word}`}
                ref={(node) => {
                  wordRefs.current[entry.index] = node;
                }}
              >
                {entry.word}
                {wordIndex === lineWords.length - 1 ? "" : " "}
              </span>
            );
          })}
        </span>
      ))}
    </p>
  );
}
