"use client";

import { m, useAnimation, useReducedMotion } from "motion/react";
import { useImperativeHandle, useRef } from "react";
import { cn } from "@/lib/utils";

const QUICK_TRANSITION = { duration: 0.4 };
const SPRING_TRANSITION = { damping: 20, stiffness: 260, type: "spring" };
const MENU_LINE_ROTATIONS = [45, 0, -45];
const MENU_LINE_OFFSETS = [6, 0, -6];

function canAnimateDecorativePointer() {
  return !!globalThis.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
}

function useIconAnimation(ref, onPointerEnter, onPointerLeave) {
  const controls = useAnimation();
  const shouldReduceMotion = !!useReducedMotion();
  const isControlledRef = useRef(false);

  const startAnimation = () => {
    controls.start(shouldReduceMotion ? "normal" : "animate");
  };
  const stopAnimation = () => controls.start("normal");

  useImperativeHandle(ref, () => {
    isControlledRef.current = true;
    return { startAnimation, stopAnimation };
  });

  return {
    controls,
    onPointerEnter: (event) => {
      onPointerEnter?.(event);
      if (!(isControlledRef.current || !canAnimateDecorativePointer())) {
        startAnimation();
      }
    },
    onPointerLeave: (event) => {
      onPointerLeave?.(event);
      if (!isControlledRef.current) {
        stopAnimation();
      }
    },
  };
}

function IconRoot({ children, className, handlers, ...props }) {
  return (
    <span
      className={cn("inline-flex shrink-0", className)}
      onPointerEnter={handlers.onPointerEnter}
      onPointerLeave={handlers.onPointerLeave}
      {...props}
    >
      {children}
    </span>
  );
}

function IconSvg({ children, size, strokeWidth = 2, ...props }) {
  return (
    <svg
      fill="none"
      focusable="false"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {children}
    </svg>
  );
}

export function useAnimatedIconTrigger(...iconRefs) {
  const start = () => {
    for (const iconRef of iconRefs) {
      iconRef?.current?.startAnimation();
    }
  };
  const stop = () => {
    for (const iconRef of iconRefs) {
      iconRef?.current?.stopAnimation();
    }
  };
  const startForFinePointer = () => {
    if (canAnimateDecorativePointer()) {
      start();
    }
  };

  return {
    onPointerEnter: startForFinePointer,
    onPointerLeave: stop,
  };
}

export function ArrowLeftIcon({
  className,
  onPointerEnter,
  onPointerLeave,
  ref,
  size = 28,
  strokeWidth,
  ...props
}) {
  const handlers = useIconAnimation(ref, onPointerEnter, onPointerLeave);
  return (
    <IconRoot className={className} handlers={handlers} {...props}>
      <IconSvg size={size} strokeWidth={strokeWidth}>
        <m.path
          animate={handlers.controls}
          d="m12 19-7-7 7-7"
          initial="normal"
          variants={{
            animate: { transform: ["translateX(0)", "translateX(3px)", "translateX(0)"] },
            normal: { transform: "translateX(0)" },
          }}
        />
        <m.path
          animate={handlers.controls}
          d="M19 12H5"
          initial="normal"
          variants={{
            animate: { d: ["M19 12H5", "M19 12H10", "M19 12H5"], transition: QUICK_TRANSITION },
            normal: { d: "M19 12H5" },
          }}
        />
      </IconSvg>
    </IconRoot>
  );
}

export function ArrowRightIcon({
  className,
  onPointerEnter,
  onPointerLeave,
  ref,
  size = 28,
  strokeWidth,
  ...props
}) {
  const handlers = useIconAnimation(ref, onPointerEnter, onPointerLeave);
  return (
    <IconRoot className={className} handlers={handlers} {...props}>
      <IconSvg size={size} strokeWidth={strokeWidth}>
        <m.path
          animate={handlers.controls}
          d="M5 12h14"
          initial="normal"
          variants={{
            animate: { d: ["M5 12h14", "M5 12h9", "M5 12h14"], transition: QUICK_TRANSITION },
            normal: { d: "M5 12h14" },
          }}
        />
        <m.path
          animate={handlers.controls}
          d="m12 5 7 7-7 7"
          initial="normal"
          variants={{
            animate: { transform: ["translateX(0)", "translateX(-3px)", "translateX(0)"] },
            normal: { transform: "translateX(0)" },
          }}
        />
      </IconSvg>
    </IconRoot>
  );
}

export function BriefcaseBusinessIcon({
  className,
  onPointerEnter,
  onPointerLeave,
  ref,
  size = 28,
  strokeWidth,
  ...props
}) {
  const handlers = useIconAnimation(ref, onPointerEnter, onPointerLeave);
  return (
    <IconRoot className={className} handlers={handlers} {...props}>
      <m.svg
        animate={handlers.controls}
        fill="none"
        focusable="false"
        height={size}
        initial="normal"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth ?? 2}
        style={{ transformOrigin: "12px 4px" }}
        variants={{
          animate: {
            rotate: [0, 4, -3, 2, 0],
            transition: { duration: 0.9, ease: "easeInOut", times: [0, 0.25, 0.5, 0.75, 1] },
          },
          normal: { rotate: 0, transition: { duration: 0.3, ease: "easeOut" } },
        }}
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 12h.01" />
        <path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        <path d="M22 13a18.15 18.15 0 0 1-20 0" />
        <rect height="14" rx="2" width="20" x="2" y="6" />
      </m.svg>
    </IconRoot>
  );
}

export function ChevronDownIcon({
  className,
  onPointerEnter,
  onPointerLeave,
  ref,
  size = 28,
  strokeWidth,
  ...props
}) {
  const handlers = useIconAnimation(ref, onPointerEnter, onPointerLeave);
  return (
    <IconRoot className={className} handlers={handlers} {...props}>
      <IconSvg size={size} strokeWidth={strokeWidth}>
        <m.path
          animate={handlers.controls}
          d="m6 9 6 6 6-6"
          initial="normal"
          transition={{ duration: 0.5, times: [0, 0.4, 1] }}
          variants={{ animate: { y: [0, 2, 0] }, normal: { y: 0 } }}
        />
      </IconSvg>
    </IconRoot>
  );
}

export function CompassIcon({
  className,
  onPointerEnter,
  onPointerLeave,
  ref,
  size = 28,
  strokeWidth,
  ...props
}) {
  const handlers = useIconAnimation(ref, onPointerEnter, onPointerLeave);
  return (
    <IconRoot className={className} handlers={handlers} {...props}>
      <IconSvg size={size} strokeWidth={strokeWidth}>
        <circle cx="12" cy="12" r="10" />
        <m.polygon
          animate={handlers.controls}
          initial="normal"
          points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"
          transition={{ damping: 15, stiffness: 120, type: "spring" }}
          variants={{ animate: { rotate: 360 }, normal: { rotate: 0 } }}
        />
      </IconSvg>
    </IconRoot>
  );
}

export function MenuIcon({
  className,
  onPointerEnter,
  onPointerLeave,
  ref,
  size = 28,
  strokeWidth,
  ...props
}) {
  const handlers = useIconAnimation(ref, onPointerEnter, onPointerLeave);
  const variants = {
    animate: (line) => ({
      opacity: line === 2 ? 0 : 1,
      rotate: MENU_LINE_ROTATIONS[line - 1],
      transition: SPRING_TRANSITION,
      y: MENU_LINE_OFFSETS[line - 1],
    }),
    normal: { opacity: 1, rotate: 0, y: 0 },
  };
  return (
    <IconRoot className={className} handlers={handlers} {...props}>
      <IconSvg size={size} strokeWidth={strokeWidth}>
        {[6, 12, 18].map((y, index) => (
          <m.line
            animate={handlers.controls}
            custom={index + 1}
            initial="normal"
            key={y}
            variants={variants}
            x1="4"
            x2="20"
            y1={y}
            y2={y}
          />
        ))}
      </IconSvg>
    </IconRoot>
  );
}

export function PauseIcon({
  className,
  onPointerEnter,
  onPointerLeave,
  ref,
  size = 28,
  strokeWidth,
  ...props
}) {
  const handlers = useIconAnimation(ref, onPointerEnter, onPointerLeave);
  return (
    <IconRoot className={className} handlers={handlers} {...props}>
      <IconSvg size={size} strokeWidth={strokeWidth}>
        {[6, 14].map((x, index) => (
          <m.rect
            animate={handlers.controls}
            height="16"
            initial="normal"
            key={x}
            rx="1"
            variants={{
              animate: {
                transition: { duration: 0.5, times: [0, 0.2, 0.5, 1] },
                y: index === 0 ? [0, 2, 0, 0] : [0, 0, 2, 0],
              },
              normal: { y: 0 },
            }}
            width="4"
            x={x}
            y="4"
          />
        ))}
      </IconSvg>
    </IconRoot>
  );
}

export function PhoneCallIcon({
  className,
  onPointerEnter,
  onPointerLeave,
  ref,
  size = 28,
  strokeWidth,
  ...props
}) {
  const handlers = useIconAnimation(ref, onPointerEnter, onPointerLeave);
  return (
    <IconRoot className={className} handlers={handlers} {...props}>
      <m.svg
        animate={handlers.controls}
        fill="none"
        focusable="false"
        height={size}
        initial="normal"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth ?? 2}
        variants={{
          animate: {
            rotate: [10, 20, -10, 10, 0],
            scale: [1, 1.1, 1.2, 1.1, 1],
            transition: { duration: 0.9, ease: "easeInOut" },
          },
          normal: { rotate: 0, scale: 1 },
        }}
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M13 2a9 9 0 0 1 9 9" />
        <path d="M13 6a5 5 0 0 1 5 5" />
        <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
      </m.svg>
    </IconRoot>
  );
}

export function PlayIcon({
  className,
  onPointerEnter,
  onPointerLeave,
  ref,
  size = 28,
  strokeWidth,
  ...props
}) {
  const handlers = useIconAnimation(ref, onPointerEnter, onPointerLeave);
  return (
    <IconRoot className={className} handlers={handlers} {...props}>
      <IconSvg size={size} strokeWidth={strokeWidth}>
        <m.polygon
          animate={handlers.controls}
          initial="normal"
          points="6 3 20 12 6 21 6 3"
          variants={{
            animate: {
              rotate: [0, -10, 0, 0],
              transition: { duration: 0.5, times: [0, 0.2, 0.5, 1] },
              x: [0, -1, 2, 0],
            },
            normal: { rotate: 0, x: 0 },
          }}
        />
      </IconSvg>
    </IconRoot>
  );
}

export function PlusIcon({
  className,
  onPointerEnter,
  onPointerLeave,
  ref,
  size = 28,
  strokeWidth,
  ...props
}) {
  const handlers = useIconAnimation(ref, onPointerEnter, onPointerLeave);
  return (
    <IconRoot className={className} handlers={handlers} {...props}>
      <m.svg
        animate={handlers.controls}
        fill="none"
        focusable="false"
        height={size}
        initial="normal"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth ?? 2}
        transition={{ damping: 15, stiffness: 100, type: "spring" }}
        variants={{ animate: { rotate: 180 }, normal: { rotate: 0 } }}
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M5 12h14" />
        <path d="M12 5v14" />
      </m.svg>
    </IconRoot>
  );
}

export function SendIcon({
  className,
  onPointerEnter,
  onPointerLeave,
  ref,
  size = 28,
  strokeWidth,
  ...props
}) {
  const handlers = useIconAnimation(ref, onPointerEnter, onPointerLeave);
  return (
    <IconRoot className={className} handlers={handlers} {...props}>
      <IconSvg className="overflow-visible" size={size} strokeWidth={strokeWidth}>
        <m.g
          animate={handlers.controls}
          initial="normal"
          transition={{ duration: 0.5 }}
          variants={{
            animate: { scale: 0.8, x: 3, y: -3 },
            normal: { scale: 1, x: 0, y: 0 },
          }}
        >
          <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
          <path d="m21.854 2.147-10.94 10.939" />
        </m.g>
        <m.path
          animate={handlers.controls}
          d="M -3 28 C -0.5 26.8 1.6 24.6 3.3 22 C 4.8 19.7 5.2 17.6 4.2 16.1 C 3.2 14.7 1.4 14.5 0.3 15.8 C -0.9 17.2 -0.6 19.4 1.2 20.4 C 3.4 21.5 6.4 19.4 9 15.8"
          fill="none"
          initial="normal"
          strokeDasharray="2 2"
          strokeWidth="1"
          variants={{
            animate: {
              opacity: 1,
              pathLength: 1,
              transition: { delay: 0.1, duration: 0.55 },
              x: 0,
              y: 0,
            },
            normal: { opacity: 0, pathLength: 0, transition: { duration: 0.3 }, x: -3, y: 3 },
          }}
        />
      </IconSvg>
    </IconRoot>
  );
}

export function UserIcon({
  className,
  onPointerEnter,
  onPointerLeave,
  ref,
  size = 28,
  strokeWidth,
  ...props
}) {
  const handlers = useIconAnimation(ref, onPointerEnter, onPointerLeave);
  return (
    <IconRoot className={className} handlers={handlers} {...props}>
      <IconSvg size={size} strokeWidth={strokeWidth}>
        <m.circle
          animate={handlers.controls}
          cx="12"
          cy="8"
          initial="normal"
          r="5"
          variants={{
            animate: { pathLength: [0, 1], pathOffset: [1, 0], scale: [0.5, 1] },
            normal: { pathLength: 1, pathOffset: 0, scale: 1 },
          }}
        />
        <m.path
          animate={handlers.controls}
          d="M20 21a8 8 0 0 0-16 0"
          initial="normal"
          transition={{ delay: 0.2, duration: 0.4 }}
          variants={{
            animate: { opacity: [0, 1], pathLength: [0, 1], pathOffset: [1, 0] },
            normal: { opacity: 1, pathLength: 1, pathOffset: 0 },
          }}
        />
      </IconSvg>
    </IconRoot>
  );
}

export function XIcon({
  className,
  onPointerEnter,
  onPointerLeave,
  ref,
  size = 28,
  strokeWidth,
  ...props
}) {
  const handlers = useIconAnimation(ref, onPointerEnter, onPointerLeave);
  const variants = {
    animate: { opacity: [0, 1], pathLength: [0, 1] },
    normal: { opacity: 1, pathLength: 1 },
  };
  return (
    <IconRoot className={className} handlers={handlers} {...props}>
      <IconSvg size={size} strokeWidth={strokeWidth}>
        <m.path animate={handlers.controls} d="M18 6 6 18" initial="normal" variants={variants} />
        <m.path
          animate={handlers.controls}
          d="m6 6 12 12"
          initial="normal"
          transition={{ delay: 0.2 }}
          variants={variants}
        />
      </IconSvg>
    </IconRoot>
  );
}
