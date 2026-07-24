"use client";

import type { AnimationPlaybackControls, MotionValue } from "motion/react";
import { AnimatePresence, animate, m, useMotionValue, useTransform } from "motion/react";
import { type ReactNode, useRef, useState } from "react";
import { useMotionUITheme, useMotionUITransition } from "@/components/motion-ui/ui-theme";

/** shadcn's ring utilities, the shared focus-visible treatment for the styled
 *  button. */
const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-citius-blue focus-visible:ring-offset-2 focus-visible:ring-offset-white";

/** Scale reached at the end of a full-motion hold. Success mode multiplies
 *  back by its reciprocal so the button springs to its resting size without
 *  disturbing the completed progress wipe underneath. */
const HELD_SCALE = 0.8;

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * ==============   useHoldToDelete   ================
 */

export interface UseHoldToDeleteOptions {
  /** Seconds the gesture must be held for `progress` to reach 1 and confirm.
   *  Default 2. */
  holdSeconds?: number;
  /** Fired when a hold is released before it completes (the retract). */
  onCancel?: () => void;
  /** Fired once when a hold completes (progress reaches 1). Update your own
   *  confirmed/committed state here. */
  onConfirm?: () => void;
}

export interface UseHoldToDeleteResult {
  /** Spread onto the interactive element (a `<button>`): pointer-capture hold,
   *  release-to-cancel, and Space-key hold, plus a context-menu
   *  guard so a long-press does not open the OS callout. */
  holdHandlers: {
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => void;
    onPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => void;
    onPointerLeave: (event: React.PointerEvent<HTMLButtonElement>) => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
    onKeyUp: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
    onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
  };
  /** The single source of truth: 0 at rest, 1 confirmed. Drive any animation
   *  off it (a fill wipe, a scale, a ring) with `useTransform`. */
  progress: MotionValue<number>;
  /** Stop any in-flight ramp and snap `progress` back to 0, clearing the
   *  completed lock so the gesture can run again. */
  reset: () => void;
}

/** Headless press-and-hold: owns the `progress` MotionValue and the whole
 *  gesture, leaving the surface (and what `progress` drives) entirely to the
 *  consumer. */
export function useHoldToDelete({
  holdSeconds = 2,
  onConfirm,
  onCancel,
}: UseHoldToDeleteOptions = {}): UseHoldToDeleteResult {
  // Retract with the theme's "snap" transition (tween degradation), so the
  // cancel feel is a token, never a magic number.
  const snapTransition = useMotionUITransition("snap");

  // 0 at rest, 1 confirmed. Every derived animation reads it.
  const progress = useMotionValue(0);
  const holdAnim = useRef<AnimationPlaybackControls | null>(null);
  const holding = useRef(false);
  const done = useRef(false);

  const startHold = () => {
    if (done.current || holding.current) {
      return;
    }
    holding.current = true;
    holdAnim.current?.stop();
    progress.set(0);
    // A deterministic easeOut ramp: progress must reach full exactly when the
    // hold completes, so this is a functional ramp, not a feel spring (which
    // would overshoot a progress meter).
    holdAnim.current = animate(progress, 1, {
      duration: holdSeconds,
      ease: "easeOut",
      onComplete: () => {
        holding.current = false;
        done.current = true;
        onConfirm?.();
      },
    });
  };

  const cancelHold = () => {
    if (!holding.current) {
      return;
    }
    holding.current = false;
    holdAnim.current?.stop();
    holdAnim.current = animate(progress, 0, { ...snapTransition, type: "tween" });
    onCancel?.();
  };

  const reset = () => {
    holdAnim.current?.stop();
    holding.current = false;
    done.current = false;
    progress.set(0);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    // Ignore the OS key-repeat that fires while a key is held down.
    if (event.repeat) {
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      startHold();
    }
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === " ") {
      event.preventDefault();
      cancelHold();
    }
  };

  return {
    holdHandlers: {
      onContextMenu: (event) => event.preventDefault(),
      onKeyDown: handleKeyDown,
      onKeyUp: handleKeyUp,
      onPointerCancel: cancelHold,
      onPointerDown: (event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        startHold();
      },
      onPointerLeave: cancelHold,
      onPointerUp: cancelHold,
    },
    progress,
    reset,
  };
}

/**
 * ==============   HoldToDeleteButton   ================
 */

export interface HoldToDeleteButtonProps {
  /** Points at the consumer's own hint/instruction text, wired through to the
   *  button's `aria-describedby`. */
  "aria-describedby"?: string;
  /** The button label (typically an icon + text). Rendered in BOTH the
   *  resting layer and the clipped destructive fill layer, so it is legible at
   *  every point of the wipe. */
  children?: ReactNode;
  /** Merged onto the button element. */
  className?: string;
  /** Test hook for Playwright / mounted harnesses. */
  "data-testid"?: string;
  /** Disables the hold gesture (e.g. while a delete mutation is pending). */
  disabled?: boolean;
  /** Seconds the button must be held to confirm. Default 2. */
  holdSeconds?: number;
  /** What happens visually after confirmation. `"callback"` leaves the
   *  completed state to the consumer, which can replace surrounding content.
   *  `"success"` keeps the button mounted and wipes its success state in from
   *  the left. Default `"callback"`. */
  mode?: "callback" | "success";
  /** Fired when the hold is released early. */
  onCancel?: () => void;
  /** Fired once the hold completes. Flip your own confirmed state here. */
  onConfirm?: () => void;
  /** Label shown beside the built-in check in `"success"` mode. Default
   *  `"Deleted"`. */
  successLabel?: ReactNode;
}

/** The finished destructive hold button: a resting light pill whose
 *  label is wiped left-to-right by an opaque danger fill as the hold
 *  advances, paired with a slow scale-down. One fill, no competing ring - the
 *  sole progress signal. Drives itself off `useHoldToDelete`. */
export function HoldToDeleteButton({
  holdSeconds = 2,
  mode = "callback",
  successLabel = "Deleted",
  onConfirm,
  onCancel,
  children,
  className,
  disabled = false,
  "aria-describedby": ariaDescribedby,
  "data-testid": dataTestId,
}: HoldToDeleteButtonProps) {
  const { motionMode } = useMotionUITheme();
  const still = motionMode === "off";
  const calm = motionMode === "calm";
  const motionAllowed = motionMode === "full";
  const successTransition = useMotionUITransition("ui");
  const restoreTransition = useMotionUITransition("snap");
  const successScale = useMotionValue(1);
  const [confirmed, setConfirmed] = useState(false);
  const { progress, holdHandlers } = useHoldToDelete({
    holdSeconds,
    onCancel,
    onConfirm: () => {
      if (mode === "success") {
        setConfirmed(true);
        animate(successScale, motionAllowed ? 1 / HELD_SCALE : 1, {
          ...restoreTransition,
        });
      }
      onConfirm?.();
    },
  });

  // Every derived animation reads `progress`. The scale-down is a transform,
  // so it drops under reduced motion; the fill wipe is functional feedback and
  // survives it.
  const holdScale = useTransform(progress, [0, 1], [1, motionAllowed ? HELD_SCALE : 1]);
  const buttonScale = useTransform(() => holdScale.get() * successScale.get());
  // Left-to-right reveal of the destructive fill layer. clip-path keeps the
  // fill a single opaque layer - no alpha haze.
  const fillClip = useTransform(progress, [0, 1], ["inset(0 100% 0 0)", "inset(0 0% 0 0)"]);
  const successInitial = still
    ? false
    : calm
      ? { opacity: 0 }
      : { clipPath: "inset(0 100% 0 0)", opacity: 1 };
  const successAnimate = calm ? { opacity: 1 } : { clipPath: "inset(0 0% 0 0)", opacity: 1 };
  const successSwapTransition = still
    ? { duration: 0 }
    : calm
      ? {
          duration: successTransition.opacity.duration,
          ease: successTransition.opacity.ease,
        }
      : successTransition;
  const successComplete = mode === "success" && confirmed;
  const interactive = !(disabled || successComplete);

  return (
    <m.button
      aria-describedby={ariaDescribedby}
      aria-disabled={!interactive || undefined}
      data-testid={dataTestId}
      disabled={disabled || undefined}
      type="button"
      {...(interactive ? holdHandlers : {})}
      // The two -webkit arbitrary properties are behavioural, not a token
      // concern: they suppress the iOS long-press callout + tap highlight so a
      // press-and-hold reads as a gesture, not a text selection. Kept on the
      // component so the button is self-contained.
      className={cx(
        "relative z-0 inline-flex min-h-11 touch-none select-none items-center justify-center overflow-hidden rounded-full border border-[#f1c4bf] bg-white px-4 font-bold text-[#b42318] text-sm [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] disabled:cursor-not-allowed disabled:opacity-60",
        FOCUS_RING,
        className
      )}
      style={{ scale: buttonScale }}
    >
      {/* Base label, visible over the un-filled (secondary) portion. */}
      <span
        aria-hidden={successComplete || undefined}
        className="relative z-10 inline-flex items-center gap-2"
      >
        {children}
      </span>
      {/* Fill layer: an opaque destructive surface carrying its OWN copy of the
          label in destructive-foreground, clipped to the advancing fill edge so
          every pixel is either fully secondary+secondary-text or fully
          destructive+destructive-fg-text - legible at any progress, no
          mid-sweep contrast wobble. */}
      <m.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 inline-flex items-center justify-center gap-2 bg-[#b42318] text-white"
        style={{ clipPath: fillClip }}
      >
        {children}
      </m.span>
      <AnimatePresence initial={false}>
        {successComplete ? (
          <m.span
            animate={successAnimate}
            className="pointer-events-none absolute inset-0 z-30 inline-flex items-center justify-center gap-2 bg-citius-blue text-white"
            initial={successInitial}
            key="success"
            role="status"
            transition={successSwapTransition}
          >
            <SuccessIcon />
            {successLabel}
          </m.span>
        ) : null}
      </AnimatePresence>
    </m.button>
  );
}

function SuccessIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="16"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
