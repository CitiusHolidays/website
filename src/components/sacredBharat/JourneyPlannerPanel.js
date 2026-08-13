"use client";

import { Loader2, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SacredBharatContactHandoff } from "@/components/ui/ConciergeContactHandoff";
import { markClientAiMessageTerminal } from "@/lib/ai/uiMessageStream";
import { suggestNextJourneys } from "@/lib/sacredBharat/journeyPlanner";
import { streamJourneyPlannerResponse } from "@/lib/sacredBharat/journeyPlannerStream";
import { formatJourneyPlannerResponseError } from "@/lib/userFacingErrors";
import { cn } from "@/lib/utils";
import { useSacredBharatContext } from "./SacredBharatProvider";

// Streamdown plus the optional code/math/mermaid plugins are only useful after a plan has
// arrived. Keep that renderer out of the Sacred Bharat first paint and fetch it when the
// response's markdown is first rendered.
let messageResponseModulePromise;

function LazyMessageResponse({ children, className }) {
  const [MessageResponse, setMessageResponse] = useState(null);

  useEffect(() => {
    messageResponseModulePromise ??= import("@/components/ai-elements/message").then(
      (module) => module.MessageResponse
    );
    let active = true;
    messageResponseModulePromise.then((module) => {
      if (active) {
        setMessageResponse(() => module);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (!MessageResponse) {
    return (
      <p className="text-brand-muted text-sm" role="status">
        Formatting your journey details…
      </p>
    );
  }
  return <MessageResponse className={className}>{children}</MessageResponse>;
}

export function JourneyPlanResponse({ message }) {
  if (!message) {
    return null;
  }
  const terminalCopy = {
    cancelled: "Journey planning cancelled.",
    failed: "Journey planning failed before completion.",
    interrupted: "Journey planning was interrupted; the partial plan is preserved below.",
  }[message.terminalState];

  return (
    <div className="mt-6 space-y-3 font-sans text-brand-dark">
      {message.parts.map((part) => {
        const key = `${message.id}-${part.type}-${part.id}`;
        if (part.type === "text") {
          return (
            <LazyMessageResponse className="prose prose-sm max-w-none" key={key}>
              {part.text}
            </LazyMessageResponse>
          );
        }
        if (part.type === "reasoning" || part.type === "status") {
          return (
            <p className="text-brand-muted text-sm" key={key} role="status">
              {part.status === "complete"
                ? "Journey details prepared"
                : "Preparing journey details…"}
            </p>
          );
        }
        if (part.type === "error") {
          return (
            <p
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800 text-sm"
              key={key}
            >
              {part.text}
            </p>
          );
        }
        return null;
      })}
      {terminalCopy ? <p className="text-brand-muted text-xs">{terminalCopy}</p> : null}
    </div>
  );
}

export default function JourneyPlannerPanel() {
  const { progress, visitedTempleIds } = useSacredBharatContext();
  const [focusTempleId, setFocusTempleId] = useState(null);
  const [completedPlanTempleId, setCompletedPlanTempleId] = useState(null);
  const [planMessage, setPlanMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const abortRef = useRef(null);
  const mountedRef = useRef(false);

  const suggestions = suggestNextJourneys(visitedTempleIds, { limit: 4 });
  const activeFocus = focusTempleId ?? suggestions[0]?.temple?.id ?? null;

  const generatePlan = async () => {
    if (!activeFocus || isLoading) {
      return;
    }

    setPlanMessage(null);
    setCompletedPlanTempleId(null);
    setErrorMessage("");
    setIsLoading(true);

    const abortController = new AbortController();
    abortRef.current = abortController;

    const wishlistTrailSlugs = [];
    for (const item of progress.wishlist ?? []) {
      if (item.itemType === "trail") {
        wishlistTrailSlugs.push(item.itemId);
      }
    }

    await streamJourneyPlannerResponse({
      focusTempleId: activeFocus,
      onMessage: (message) => {
        if (mountedRef.current && abortRef.current === abortController) {
          setPlanMessage(() => message);
          if (message.terminalState === "complete") {
            setCompletedPlanTempleId(activeFocus);
          }
        }
      },
      onStreamError: (message) => {
        if (mountedRef.current && abortRef.current === abortController) {
          setErrorMessage(() => message);
        }
      },
      signal: abortController.signal,
      visitedTempleIds,
      wishlistTrailSlugs,
    }).catch(() => {
      if (mountedRef.current && !abortController.signal.aborted) {
        setErrorMessage(formatJourneyPlannerResponseError());
      }
    });

    if (abortRef.current === abortController) {
      abortRef.current = null;
    }
    if (mountedRef.current) {
      setIsLoading(false);
    }
  };

  const cancelPlan = () => {
    const abortController = abortRef.current;
    if (!abortController) {
      return;
    }
    abortRef.current = null;
    abortController.abort("user-cancelled");
    setPlanMessage((message) =>
      message ? markClientAiMessageTerminal(message, "cancelled") : message
    );
    setIsLoading(false);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort("component-unmounted");
      abortRef.current = null;
    };
  }, []);

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
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-citius-orange/10 text-public-orange-ink">
          <Sparkles className="size-5" />
        </span>
        <div>
          <h2 className="font-heading text-brand-dark text-xl">AI Journey Planner</h2>
          <p className="mt-1 font-sans text-brand-muted text-sm">
            Personalized pilgrimage ideas from your Soul Score progress — season, airport,
            mythology, and day-by-day outline.
          </p>
          <p className="mt-1 font-sans text-brand-muted text-xs">
            Do not include passport, payment, or other sensitive personal information.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {suggestions.map((plan) => (
          <button
            className={cn(
              "rounded-full border px-3 py-1.5 font-medium text-sm transition-colors",
              activeFocus === plan.temple.id
                ? "border-citius-orange bg-citius-orange/10 text-public-orange-ink"
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

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="inline-flex items-center gap-2 rounded-full bg-citius-blue px-5 py-2.5 font-medium text-sm text-white hover:bg-citius-blue/90 disabled:opacity-60"
          disabled={isLoading || !activeFocus}
          onClick={generatePlan}
          type="button"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {isLoading
            ? "Planning your pilgrimage…"
            : ["cancelled", "failed", "interrupted"].includes(planMessage?.terminalState)
              ? "Retry journey plan"
              : "Plan my journey with AI"}
        </button>
        {isLoading ? (
          <button
            className="inline-flex items-center gap-2 rounded-full border border-citius-blue px-4 py-2.5 font-medium text-citius-blue text-sm hover:bg-citius-blue/5"
            onClick={cancelPlan}
            type="button"
          >
            <Square className="size-3.5 fill-current" />
            Cancel
          </button>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800 text-sm">
          {errorMessage}
        </p>
      ) : null}

      <JourneyPlanResponse message={planMessage} />
      {planMessage?.terminalState === "complete" && completedPlanTempleId ? (
        <div className="mt-6">
          <SacredBharatContactHandoff
            context={{ entryPoint: "journey_planner", templeId: completedPlanTempleId }}
            key={completedPlanTempleId}
            triggerLabel="Plan this journey with Citius"
          />
        </div>
      ) : null}
    </div>
  );
}
