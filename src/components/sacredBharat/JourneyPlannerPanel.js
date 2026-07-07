"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { suggestNextJourneys } from "@/lib/sacredBharat/journeyPlanner";
import { streamJourneyPlannerResponse } from "@/lib/sacredBharat/journeyPlannerStream";
import { cn } from "@/utils/cn";
import { useSacredBharatContext } from "./SacredBharatProvider";

export default function JourneyPlannerPanel() {
  const { progress, visitedTempleIds } = useSacredBharatContext();
  const [focusTempleId, setFocusTempleId] = useState(null);
  const [planText, setPlanText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const abortRef = useRef(null);

  const suggestions = suggestNextJourneys(visitedTempleIds, { limit: 4 });
  const activeFocus = focusTempleId ?? suggestions[0]?.temple?.id ?? null;

  const generatePlan = async () => {
    if (!activeFocus || isLoading) {
      return;
    }

    setPlanText("");
    setErrorMessage("");
    setIsLoading(true);

    const abortController = new AbortController();
    abortRef.current = abortController;

    const wishlistTrailSlugs =
      progress.wishlist
        ?.filter((item) => item.itemType === "trail")
        .map((item) => item.itemId) ?? [];

    await streamJourneyPlannerResponse({
      focusTempleId: activeFocus,
      onStreamError: (message) => setErrorMessage(message),
      onTextDelta: (text) => setPlanText(text),
      signal: abortController.signal,
      visitedTempleIds,
      wishlistTrailSlugs,
    }).catch(() => {
      if (!abortController.signal.aborted) {
        setErrorMessage("Could not generate your journey plan. Please try again.");
      }
    });

    if (abortRef.current === abortController) {
      abortRef.current = null;
    }
    setIsLoading(false);
  };

  if (suggestions.length === 0) {
    return (
      <div className="rounded-2xl border border-brand-light bg-white p-6 text-center">
        <p className="font-heading text-brand-dark text-lg">All catalog sites visited!</p>
        <p className="mt-2 font-sans text-brand-muted text-sm">
          You have marked every Sacred Bharat sacred site. Share your yatri passport or explore
          trails for completion bonuses.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-light bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-citius-orange/10 text-citius-orange">
          <Sparkles className="size-5" />
        </span>
        <div>
          <h2 className="font-heading text-brand-dark text-xl">AI Journey Planner</h2>
          <p className="mt-1 font-sans text-brand-muted text-sm">
            Personalized pilgrimage ideas from your Soul Score progress — season, airport, mythology,
            and day-by-day outline.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {suggestions.map((plan) => (
          <button
            className={cn(
              "rounded-full border px-3 py-1.5 font-medium text-sm transition-colors",
              activeFocus === plan.temple.id
                ? "border-citius-orange bg-citius-orange/10 text-citius-orange"
                : "border-brand-light text-brand-muted hover:border-citius-blue"
            )}
            key={plan.temple.id}
            onClick={() => setFocusTempleId(plan.temple.id)}
            type="button"
          >
            {plan.temple.name} · {plan.pointsAvailable} pts
          </button>
        ))}
      </div>

      <button
        className="inline-flex items-center gap-2 rounded-full bg-citius-blue px-5 py-2.5 font-medium text-sm text-white hover:bg-citius-blue/90 disabled:opacity-60"
        disabled={isLoading || !activeFocus}
        onClick={generatePlan}
        type="button"
      >
        {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {isLoading ? "Planning your pilgrimage…" : "Plan my journey with AI"}
      </button>

      {errorMessage ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800 text-sm">
          {errorMessage}
        </p>
      ) : null}

      {planText ? (
        <div className="prose prose-sm mt-6 max-w-none whitespace-pre-wrap font-sans text-brand-dark">
          {planText}
        </div>
      ) : null}
    </div>
  );
}
