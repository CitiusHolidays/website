"use client";
import {
  Briefcase,
  FileBadge,
  Globe,
  MapPinned,
  Medal,
  Plane,
  ShieldCheck,
  Star,
  Sun,
  Trophy,
  Users,
} from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PUBLIC_SERVICES } from "@/data/publicServices";
import CitiusLogo from "@/static/logos/logo.webp";

const serviceIcons = {
  branding: Star,
  "celebrity-management": Medal,
  "domestic-travel": MapPinned,
  "event-management": Users,
  "international-travel": Globe,
  mice: Briefcase,
  "onsite-travel-desk": Plane,
  "spiritual-trails": Sun,
  "sporting-events": Trophy,
  "travel-insurance": ShieldCheck,
  "visa-assistance": FileBadge,
};

const services = PUBLIC_SERVICES.map((service) => ({
  ...service,
  icon: serviceIcons[service.id],
}));

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onStoreChange) {
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function getReducedMotionServerSnapshot() {
  return false;
}

function useHydrationSafeReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );
}

const containerVariants = {
  hidden: {},
  show: (shouldReduceMotion) => ({
    transition: {
      delayChildren: shouldReduceMotion ? 0 : 0.2,
      staggerChildren: shouldReduceMotion ? 0 : 0.07,
    },
  }),
};

const itemVariants = {
  hidden: (service) => ({
    opacity: 0,
    scale: service.shouldReduceMotion ? 1 : 0.95,
    x: `calc(-50% + ${service.x}px)`,
    y: `calc(-50% + ${service.y}px)`,
  }),
  show: (service) => ({
    opacity: 1,
    scale: 1,
    transition: {
      duration: service.shouldReduceMotion ? 0.15 : 0.25,
      ease: [0.23, 1, 0.32, 1],
    },
    x: `calc(-50% + ${service.x}px)`,
    y: `calc(-50% + ${service.y}px)`,
  }),
};

function getServiceLayout() {
  if (!("window" in globalThis)) {
    return DESKTOP_MEDIUM_LAYOUT;
  }
  const width = window.innerWidth;
  if (width < 500) {
    return MOBILE_SMALL_LAYOUT;
  }
  if (width < 768) {
    return MOBILE_MEDIUM_LAYOUT;
  }
  if (width < 1024) {
    return DESKTOP_MEDIUM_LAYOUT;
  }
  return DESKTOP_LARGE_LAYOUT;
}

const MOBILE_SMALL_LAYOUT = Object.freeze({ isMobile: true, radius: 180 });
const MOBILE_MEDIUM_LAYOUT = Object.freeze({ isMobile: true, radius: 200 });
const DESKTOP_MEDIUM_LAYOUT = Object.freeze({ isMobile: false, radius: 240 });
const DESKTOP_LARGE_LAYOUT = Object.freeze({ isMobile: false, radius: 280 });

function subscribeServiceLayout(onStoreChange) {
  window.addEventListener("resize", onStoreChange);
  return () => window.removeEventListener("resize", onStoreChange);
}

function roundOrbitCoordinate(value) {
  return Math.round(value * 1000) / 1000;
}

export function getServiceOrbitPosition(index, totalServices, radius) {
  const angle = (index * 2 * Math.PI) / totalServices - Math.PI / 2;
  return {
    x: roundOrbitCoordinate(Math.cos(angle) * radius),
    y: roundOrbitCoordinate(Math.sin(angle) * radius),
  };
}

export function sameLinePosition(previous, next) {
  if (previous === next) {
    return true;
  }
  if (!(previous && next)) {
    return false;
  }
  return (
    previous.x1 === next.x1 &&
    previous.x2 === next.x2 &&
    previous.y1 === next.y1 &&
    previous.y2 === next.y2
  );
}

function OrbitService({
  index,
  isMobile,
  onLeave,
  onServiceRef,
  onSelect,
  service,
  shouldReduceMotion,
}) {
  const ServiceIcon = service.icon;
  const handleClick = () => {
    if (isMobile) {
      onSelect(service);
    }
  };
  const handleHoverStart = () => {
    if (!isMobile) {
      onSelect(service);
    }
  };
  const setServiceRef = (element) => onServiceRef(index, element);

  return (
    <m.div
      className="absolute z-10 flex flex-col items-center"
      custom={{ ...service, shouldReduceMotion }}
      onClick={handleClick}
      onHoverEnd={onLeave}
      onHoverStart={handleHoverStart}
      ref={setServiceRef}
      style={{ left: "50%", top: "50%" }}
      variants={itemVariants}
    >
      <button
        aria-label={`Maps to ${service.title} service`}
        className="group flex size-12 cursor-pointer items-center justify-center rounded-full border-2 border-citius-orange bg-brand-light shadow-lg focus:outline-none focus:ring-4 focus:ring-citius-orange/30 md:h-16 md:w-16 lg:h-18 lg:w-18"
        tabIndex={0}
        type="button"
      >
        <ServiceIcon className="size-6 text-citius-blue transition-colors duration-200 group-hover:text-public-orange-ink md:h-8 md:w-8 lg:h-9 lg:w-9" />
      </button>
      <span
        aria-hidden="true"
        className="mt-2 max-w-[80px] select-none text-center font-medium text-brand-dark text-xs leading-tight md:max-w-[100px] md:text-sm lg:text-base"
      >
        {service.title}
      </span>
    </m.div>
  );
}

export default function CircularServicesMenu() {
  const shouldReduceMotion = useHydrationSafeReducedMotion();
  const [selectedService, setSelectedService] = useState(null);
  const layout = useSyncExternalStore(
    subscribeServiceLayout,
    getServiceLayout,
    () => DESKTOP_MEDIUM_LAYOUT
  );
  const containerRef = useRef(null);
  const serviceRefs = useRef([]);
  const [linePos, setLinePos] = useState(null);
  const registerServiceRef = (index, element) => {
    serviceRefs.current[index] = element;
  };

  const servicePositions = services.map((service, index) => ({
    ...service,
    ...getServiceOrbitPosition(index, services.length, layout.radius),
  }));

  // Calculate line position from center to hovered/tapped service
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      let nextLinePos = null;
      if (selectedService) {
        const idx = servicePositions.findIndex((s) => s.title === selectedService.title);
        if (idx !== -1 && containerRef.current && serviceRefs.current[idx]) {
          const containerRect = containerRef.current.getBoundingClientRect();
          const serviceRect = serviceRefs.current[idx].getBoundingClientRect();
          const button = serviceRefs.current[idx].querySelector("button");
          let serviceX;
          let serviceY;
          if (button) {
            const buttonRect = button.getBoundingClientRect();
            serviceX = buttonRect.left + buttonRect.width / 2 - containerRect.left;
            serviceY = buttonRect.top + buttonRect.height / 2 - containerRect.top;
          } else {
            serviceX = serviceRect.left + serviceRect.width / 2 - containerRect.left;
            serviceY = serviceRect.top + serviceRect.height / 2 - containerRect.top;
          }
          const centerX = containerRect.width / 2;
          const centerY = containerRect.height / 2;
          nextLinePos = { x1: centerX, x2: serviceX, y1: centerY, y2: serviceY };
        }
      }
      setLinePos((previous) => (sameLinePosition(previous, nextLinePos) ? previous : nextLinePos));
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedService, servicePositions]);

  const handleServiceInteraction = (service) => {
    if (layout.isMobile) {
      setSelectedService(selectedService?.title === service.title ? null : service);
    } else {
      setSelectedService(() => service);
    }
  };

  const handleServiceLeave = () => {
    if (!layout.isMobile) {
      setSelectedService(null);
    }
  };

  return (
    <div
      className="relative flex h-[400px] w-full items-center justify-center md:h-[520px] lg:h-[600px]"
      ref={containerRef}
    >
      {/* Complete connector geometry is measured once; only its opacity transitions. */}
      <AnimatePresence>
        {linePos ? (
          <m.svg
            animate={{ opacity: 1 }}
            className="pointer-events-none absolute top-0 left-0 z-10 size-full"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.15, ease: [0.23, 1, 0.32, 1] }}
          >
            <line
              opacity={0.3}
              stroke="#9ca3af"
              strokeDasharray="6,6"
              strokeLinecap="round"
              strokeWidth="3"
              x1={linePos.x1}
              x2={linePos.x2}
              y1={linePos.y1}
              y2={linePos.y2}
            />
          </m.svg>
        ) : null}
      </AnimatePresence>
      <m.div
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-20 flex size-32 flex-col items-center justify-center rounded-full border-4 border-citius-blue bg-white px-3 pb-8 shadow-2xl md:h-52 md:w-52"
        initial={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="flex h-auto flex-col items-center justify-center">
          <div className="mb-1 flex items-center justify-center">
            <Image
              alt="Citius Logo"
              className="mx-auto size-12 object-contain md:h-20 md:w-20"
              height={60}
              priority
              src={CitiusLogo}
              style={{ objectFit: "contain" }}
              width={60}
            />
          </div>
          <AnimatePresence mode="wait">
            <m.div
              animate={{ opacity: 1, transform: "translate3d(0, 0, 0)" }}
              className="flex flex-1 flex-col justify-center text-center"
              exit={{
                opacity: 0,
                transform: shouldReduceMotion ? "none" : "translate3d(0, -10px, 0)",
              }}
              initial={{
                opacity: 0,
                transform: shouldReduceMotion ? "none" : "translate3d(0, 10px, 0)",
              }}
              key={selectedService?.title || "default"}
              transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
            >
              <h3 className="mb-1 font-bold text-brand-dark text-xs leading-tight md:text-base">
                {selectedService?.title || "Our Services"}
              </h3>
              <p className="px-1 text-brand-muted text-xs leading-tight">
                {selectedService?.description ||
                  (layout.isMobile
                    ? "Tap a service to learn more"
                    : "Hover over a service to learn more")}
              </p>
            </m.div>
          </AnimatePresence>
        </div>
      </m.div>

      <m.div
        animate="show"
        className="absolute inset-0"
        custom={shouldReduceMotion}
        initial="hidden"
        variants={containerVariants}
      >
        {servicePositions.map((service, idx) => (
          <OrbitService
            index={idx}
            isMobile={layout.isMobile}
            key={service.title}
            onLeave={handleServiceLeave}
            onSelect={handleServiceInteraction}
            onServiceRef={registerServiceRef}
            service={service}
            shouldReduceMotion={shouldReduceMotion}
          />
        ))}
      </m.div>
    </div>
  );
}
