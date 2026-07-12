"use client";

import { AnimatePresence, m, useReducedMotion, useTime, useTransform } from "motion/react";

const Badge = ({ state }) => (
  <m.div
    animate={{ transform: "translateX(0) scale(1)" }}
    className="bg-citius-orange text-brand-light"
    style={styles.badge}
    transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
  >
    <Icon state={state} />
    <Label state={state} />
  </m.div>
);

const Icon = ({ state }) => {
  let IconComponent = null;

  switch (state) {
    case "idle":
      IconComponent = null;
      break;
    case "processing":
      IconComponent = <Loader />;
      break;
    case "success":
      IconComponent = <Check />;
      break;
    case "error":
      IconComponent = <X />;
      break;
  }

  return (
    <m.span
      animate={{
        opacity: state === "idle" ? 0 : 1,
        transform: state === "idle" ? "scaleX(0.95)" : "scaleX(1)",
      }}
      style={styles.iconContainer}
      transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
    >
      <AnimatePresence>
        <m.span
          animate={{ filter: "blur(0px)", opacity: 1, transform: "translateY(0) scale(1)" }}
          exit={{ filter: "blur(4px)", opacity: 0, transform: "translateY(6px) scale(0.95)" }}
          initial={{ filter: "blur(4px)", opacity: 0, transform: "translateY(-6px) scale(0.95)" }}
          key={state}
          style={styles.icon}
          transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
        >
          {IconComponent}
        </m.span>
      </AnimatePresence>
    </m.span>
  );
};

const ICON_SIZE = 20;
const STROKE_WIDTH = 2;
const VIEW_BOX_SIZE = 24;

const svgProps = {
  fill: "none",
  height: ICON_SIZE,
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: STROKE_WIDTH,
  viewBox: `0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`,
  width: ICON_SIZE,
};

function Check() {
  return (
    <m.svg {...svgProps}>
      <m.polyline points="4 12 9 17 20 6" {...animations} />
    </m.svg>
  );
}

function Loader() {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <LoaderGraphic style={{ transform: "rotate(0deg)" }} />;
  }

  return <RotatingLoader />;
}

function RotatingLoader() {
  const time = useTime();
  const rotate = useTransform(time, [0, 1000], [0, 360], { clamp: false });

  return <LoaderGraphic style={{ rotate }} />;
}

function LoaderGraphic({ style }) {
  return (
    <m.div
      style={{
        alignItems: "center",
        display: "flex",
        height: ICON_SIZE,
        justifyContent: "center",
        width: ICON_SIZE,
        ...style,
      }}
    >
      <m.svg {...svgProps}>
        <m.path d="M21 12a9 9 0 1 1-6.219-8.56" {...animations} />
      </m.svg>
    </m.div>
  );
}

function X() {
  return (
    <m.svg {...svgProps}>
      <m.line x1="6" x2="18" y1="6" y2="18" {...animations} />
      <m.line x1="18" x2="6" y1="6" y2="18" {...secondLineAnimation} />
    </m.svg>
  );
}

const animations = {
  animate: { pathLength: 1 },
  initial: { pathLength: 0 },
  transition: { damping: 20, stiffness: 150, type: "spring" },
};

const secondLineAnimation = {
  ...animations,
  transition: { ...animations.transition, delay: 0.1 },
};

const Label = ({ state }) => (
  <m.span style={{ position: "relative" }}>
    <AnimatePresence initial={false} mode="sync">
      <m.div
        animate={{
          filter: "blur(0px)",
          opacity: 1,
          position: "relative",
          transform: "translateY(0)",
        }}
        exit={{
          filter: "blur(6px)",
          opacity: 0,
          position: "absolute",
          transform: "translateY(8px)",
        }}
        initial={{
          filter: "blur(6px)",
          opacity: 0,
          position: "absolute",
          transform: "translateY(-8px)",
        }}
        key={state}
        style={{ textWrap: "nowrap" }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      >
        {STATES[state]}
      </m.div>
    </AnimatePresence>
  </m.span>
);

const styles = {
  badge: {
    alignItems: "center",
    borderRadius: 999,
    display: "flex",
    fontWeight: 600,
    gap: 8,
    justifyContent: "center",
    overflow: "hidden",
    padding: "12px 20px",
  },
  icon: {
    left: 0,
    position: "absolute",
    top: 0,
  },
  iconContainer: {
    alignItems: "center",
    display: "flex",
    height: 20,
    justifyContent: "center",
    position: "relative",
    transformOrigin: "left center",
    width: 20,
  },
};

const STATES = {
  error: "Failed! Try again",
  idle: "Send Message",
  processing: "Sending…",
  success: "Sent!",
};

export default function AnimatedSubmitButton({ state, isSubmitting }) {
  return (
    <button className="flex w-full justify-center" disabled={isSubmitting} type="submit">
      <Badge state={state} />
    </button>
  );
}
