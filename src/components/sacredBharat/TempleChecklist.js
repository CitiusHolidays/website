"use client";

import { Check, MapPin } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useState } from "react";
import { REGION_LABELS } from "@/data/sacredBharat/regions";
import { getTempleById, TEMPLES } from "@/data/sacredBharat/temples";
import { cn } from "@/lib/utils";
import { useSacredBharatContext } from "./SacredBharatProvider";
import TempleJourneyCard from "./TempleJourneyCard";

/**
 * @param {{ templeIds?: string[], showAllTemples?: boolean }} props
 */
export function sacredVisitFeedbackMotion(shouldReduceMotion) {
  return {
    animate: { opacity: 1, transform: "translateY(0)" },
    exit: {
      opacity: 0,
      transform: shouldReduceMotion ? "translateY(0)" : "translateY(-4px)",
    },
    initial: {
      opacity: 0,
      transform: shouldReduceMotion ? "translateY(0)" : "translateY(6px)",
    },
  };
}

export function TempleVisitFeedback({ feedback, onUndo }) {
  const shouldReduceMotion = !!useReducedMotion();
  const motion = sacredVisitFeedbackMotion(shouldReduceMotion);

  return (
    <AnimatePresence initial={false} mode="wait">
      {feedback ? (
        <m.div
          animate={motion.animate}
          className="mb-3 flex items-center justify-between gap-4 rounded-xl border border-citius-orange/30 bg-citius-orange/8 px-4 py-3 text-brand-dark"
          exit={motion.exit}
          initial={motion.initial}
          key={feedback.templeId}
          role="status"
          transition={{ duration: shouldReduceMotion ? 0.01 : 0.18, ease: "easeOut" }}
        >
          <p className="text-sm">
            <strong>{feedback.templeName}</strong> added to your journey. +{feedback.points} Soul
            Score points.
          </p>
          <button
            className="min-h-11 shrink-0 rounded-full px-3 font-semibold text-citius-blue text-xs underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2"
            onClick={onUndo}
            type="button"
          >
            Undo
          </button>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

export default function TempleChecklist({ templeIds, showAllTemples = false }) {
  const { markVisited, unmarkVisited, visitedTempleIds } = useSacredBharatContext();
  const [feedback, setFeedback] = useState(null);
  const [pendingTempleId, setPendingTempleId] = useState(null);

  const list = showAllTemples
    ? TEMPLES
    : (templeIds ?? []).flatMap((id) => {
        const temple = getTempleById(id);
        return temple ? [temple] : [];
      });
  const visitedSet = new Set(visitedTempleIds);

  const handleToggle = async (temple) => {
    setPendingTempleId(temple.id);
    try {
      if (visitedSet.has(temple.id)) {
        await unmarkVisited(temple.id);
        if (feedback?.templeId === temple.id) {
          setFeedback(null);
        }
      } else {
        await markVisited(temple.id);
        setFeedback({
          points: temple.points,
          templeId: temple.id,
          templeName: temple.name,
        });
      }
    } finally {
      setPendingTempleId(null);
    }
  };

  const undoLatestVisit = async () => {
    if (!feedback) {
      return;
    }
    const { templeId } = feedback;
    setFeedback(null);
    setPendingTempleId(templeId);
    try {
      await unmarkVisited(templeId);
    } finally {
      setPendingTempleId(null);
    }
  };

  const toggleTempleFromEvent = (event) => {
    const temple = getTempleById(event.currentTarget.dataset.templeId);
    if (temple) {
      handleToggle(temple);
    }
  };

  return (
    <>
      <TempleVisitFeedback feedback={feedback} onUndo={undoLatestVisit} />
      <ul className="space-y-2">
        {list.map((temple) => {
          const visited = visitedSet.has(temple.id);
          return (
            <li key={temple.id}>
              <button
                className={cn(
                  "flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition-[border-color,background-color,color,box-shadow]",
                  visited
                    ? "border-citius-orange/35 bg-citius-orange/5"
                    : "border-brand-light bg-white hover:border-citius-blue/25"
                )}
                data-temple-id={temple.id}
                disabled={pendingTempleId === temple.id}
                onClick={toggleTempleFromEvent}
                type="button"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    visited
                      ? "border-citius-orange bg-citius-orange text-brand-dark"
                      : "border-brand-light text-transparent"
                  )}
                >
                  <Check className="size-4" strokeWidth={3} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-brand-dark">{temple.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 font-sans text-brand-muted text-xs">
                    <MapPin className="size-3 shrink-0" />
                    {temple.city}, {temple.state}
                    {showAllTemples ? (
                      <span className="ml-2 text-citius-blue/80">
                        · {REGION_LABELS[temple.region]}
                      </span>
                    ) : null}
                  </p>
                </div>
                <span className="shrink-0 text-brand-muted text-xs tabular-nums">
                  +{temple.points} pts
                </span>
              </button>
              {visited ? null : (
                <TempleJourneyCard templeId={temple.id} visitedTempleIds={visitedTempleIds} />
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
