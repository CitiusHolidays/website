export const PUBLIC_PRESS_TRANSITION = { duration: 0.15, ease: "easeOut" };
export const PUBLIC_EASE_OUT = [0.23, 1, 0.32, 1];

export function publicDisclosureMotion(shouldReduceMotion, alignment = "left") {
  const hidden = {
    opacity: 0,
    transform: shouldReduceMotion ? "none" : "translate3d(0, 6px, 0) scale(0.98)",
  };
  return {
    animate: { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
    exit: {
      ...hidden,
      transition: { duration: 0.12, ease: PUBLIC_EASE_OUT },
    },
    initial: hidden,
    style: { transformOrigin: alignment === "right" ? "top right" : "top left" },
    transition: { duration: 0.15, ease: PUBLIC_EASE_OUT },
  };
}

export function publicPressTarget(shouldReduceMotion) {
  return shouldReduceMotion ? undefined : { scale: 0.96 };
}

export function contextualIconMotion(shouldReduceMotion) {
  if (shouldReduceMotion) {
    const staticState = { filter: "none", opacity: 1, transform: "none" };
    return {
      animate: staticState,
      exit: staticState,
      initial: false,
      transition: { duration: 0 },
    };
  }
  return {
    animate: { filter: "blur(0px)", opacity: 1, transform: "scale(1)" },
    exit: { filter: "blur(4px)", opacity: 0, transform: "scale(0.25)" },
    initial: { filter: "blur(4px)", opacity: 0, transform: "scale(0.25)" },
    transition: { bounce: 0, duration: 0.3, type: "spring" },
  };
}

export function publicStageMotion(shouldReduceMotion) {
  if (shouldReduceMotion) {
    return {
      animate: { opacity: 1 },
      exit: { opacity: 0, transition: { duration: 0 } },
      initial: { opacity: 0 },
      transition: { duration: 0 },
    };
  }
  return {
    animate: { filter: "blur(0px)", opacity: 1, transform: "translate3d(0, 0, 0)" },
    exit: {
      filter: "blur(4px)",
      opacity: 0,
      transform: "translate3d(0, -12px, 0)",
      transition: { duration: 0.15, ease: PUBLIC_EASE_OUT },
    },
    initial: { filter: "blur(4px)", opacity: 0, transform: "translate3d(0, 16px, 0)" },
    transition: { duration: 0.28, ease: PUBLIC_EASE_OUT },
  };
}

export function publicRevealMotion(shouldReduceMotion) {
  if (shouldReduceMotion) {
    return {
      animate: { opacity: 1 },
      exit: { opacity: 0, transition: { duration: 0 } },
      initial: { opacity: 0 },
      transition: { duration: 0 },
    };
  }
  return {
    animate: { opacity: 1, transform: "translate3d(0, 0, 0)" },
    exit: {
      opacity: 0,
      transform: "translate3d(0, 8px, 0)",
      transition: { duration: 0.15, ease: PUBLIC_EASE_OUT },
    },
    initial: { opacity: 0, transform: "translate3d(0, 12px, 0)" },
    transition: { duration: 0.22, ease: PUBLIC_EASE_OUT },
  };
}

export function publicStaggerContainer(shouldReduceMotion) {
  return {
    animate: "visible",
    initial: "hidden",
    variants: {
      hidden: {},
      visible: {
        transition: { staggerChildren: shouldReduceMotion ? 0 : 0.08 },
      },
    },
  };
}

export function publicStaggerItem(shouldReduceMotion) {
  if (shouldReduceMotion) {
    return {
      variants: {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.16, ease: PUBLIC_EASE_OUT } },
      },
    };
  }
  return {
    variants: {
      hidden: { filter: "blur(4px)", opacity: 0, transform: "translate3d(0, 12px, 0)" },
      visible: {
        filter: "blur(0px)",
        opacity: 1,
        transform: "translate3d(0, 0, 0)",
        transition: { duration: 0.28, ease: PUBLIC_EASE_OUT },
      },
    },
  };
}
