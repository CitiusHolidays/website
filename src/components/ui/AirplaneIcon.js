"use client";

import { m, useAnimation, useReducedMotion } from "motion/react";
import { useImperativeHandle } from "react";
import { PUBLIC_EASE_OUT } from "@/lib/publicInteractionMotion";
import { cn } from "@/lib/utils";

const SPEED_LINES = [
  { delay: 0.03, x1: 5, x2: 1, y1: 15, y2: 19 },
  { delay: 0.06, x1: 7, x2: 3, y1: 17, y2: 21 },
  { delay: 0.09, x1: 9, x2: 5, y1: 19, y2: 23 },
];

// Adapted from the MIT-licensed lucide-animated airplane registry component.
export default function AirplaneIcon({ className, ref, size = 28, ...props }) {
  const controls = useAnimation();
  const shouldReduceMotion = !!useReducedMotion();

  useImperativeHandle(
    ref,
    () => ({
      startAnimation: () => controls.start(shouldReduceMotion ? "reduced" : "animate"),
      stopAnimation: () => controls.start("normal"),
    }),
    [controls, shouldReduceMotion]
  );

  return (
    <span className={cn("inline-flex", className)} {...props}>
      <svg
        className="overflow-visible"
        fill="none"
        height={size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <m.path
          animate={controls}
          d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z"
          initial="normal"
          style={{ transformOrigin: "center" }}
          variants={{
            animate: {
              transform: "translate3d(2px, -2px, 0) scale(0.92)",
              transition: { duration: 0.2, ease: PUBLIC_EASE_OUT },
            },
            normal: {
              transform: "translate3d(0, 0, 0) scale(1)",
              transition: { duration: 0.16, ease: PUBLIC_EASE_OUT },
            },
            reduced: { transform: "translate3d(0, 0, 0) scale(1)" },
          }}
        />
        {SPEED_LINES.map((line) => (
          <m.line
            animate={controls}
            initial="normal"
            key={line.delay}
            variants={{
              animate: {
                opacity: 1,
                transform: "translate3d(0, 0, 0)",
                transition: {
                  delay: line.delay,
                  duration: 0.16,
                  ease: PUBLIC_EASE_OUT,
                },
              },
              normal: {
                opacity: 0,
                transform: "translate3d(-2px, 2px, 0)",
                transition: { duration: 0.12, ease: PUBLIC_EASE_OUT },
              },
              reduced: { opacity: 0.75, transform: "translate3d(0, 0, 0)" },
            }}
            x1={line.x1}
            x2={line.x2}
            y1={line.y1}
            y2={line.y2}
          />
        ))}
      </svg>
    </span>
  );
}
