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
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import CitiusLogo from "@/static/logos/logo.webp";

const services = [
  {
    description: "Meetings, Incentives, Conferences & Exhibitions worldwide.",
    icon: Briefcase,
    path: "/mice",
    title: "MICE",
  },
  {
    description: "End-to-end visa processing and support services.",
    icon: FileBadge,
    path: "/services",
    title: "VISA Assistance",
  },
  {
    description: "From concept to execution of corporate events.",
    icon: Users,
    path: "/services",
    title: "Event Management",
  },
  {
    description: "Curated global itineraries and travel experiences.",
    icon: Globe,
    path: "/services",
    title: "International Travel",
  },
  {
    description: "Explore India with bespoke domestic journeys.",
    icon: MapPinned,
    path: "/services",
    title: "Domestic Travel",
  },
  {
    description: "Comprehensive travel insurance and protection.",
    icon: ShieldCheck,
    path: "/services",
    title: "Travel Insurance",
  },
  {
    description: "Event branding and collateral design services.",
    icon: Star,
    path: "/services",
    title: "Branding",
  },
  {
    description: "Book celebrities and performers for events.",
    icon: Medal,
    path: "/services",
    title: "Celebrity Management",
  },
  {
    description: "Access to premier sports hospitality packages.",
    icon: Trophy,
    path: "/services",
    title: "Sporting Events",
  },
  {
    description: "Dedicated travel desks for large corporate events.",
    icon: Plane,
    path: "/services",
    title: "Onsite Travel Desk",
  },
  {
    description: "Sacred journeys to spiritual destinations worldwide.",
    icon: Sun,
    path: "/pilgrimage",
    title: "Spiritual Trails",
  },
];

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
  if (typeof window === "undefined") {
    return { isMobile: false, radius: 200 };
  }
  const width = window.innerWidth;
  return {
    isMobile: width < 768,
    radius: width < 500 ? 180 : width < 768 ? 200 : width < 1024 ? 240 : 280,
  };
}

export default function CircularServicesMenu() {
  const shouldReduceMotion = useReducedMotion();
  const [selectedService, setSelectedService] = useState(null);
  const [layout, setLayout] = useState(getServiceLayout);
  const containerRef = useRef(null);
  const serviceRefs = useRef([]);
  const [linePos, setLinePos] = useState(null);

  useEffect(() => {
    function handleResize() {
      setLayout(getServiceLayout());
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const totalServices = services.length;
  const angleStep = (2 * Math.PI) / totalServices;
  const servicePositions = services.map((service, index) => {
    const angle = index * angleStep - Math.PI / 2; // Start from top
    const x = Math.cos(angle) * layout.radius;
    const y = Math.sin(angle) * layout.radius;
    return {
      ...service,
      angle,
      x,
      y,
    };
  });

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
      setLinePos(nextLinePos);
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
      {/* Animated line from center to hovered/tapped service */}
      <AnimatePresence>
        {linePos && (
          <m.svg
            animate={{ opacity: 1 }}
            className="pointer-events-none absolute top-0 left-0 z-10 size-full"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
          >
            <m.line
              animate={{ x2: linePos.x2, y2: linePos.y2 }}
              initial={{ x2: linePos.x1, y2: linePos.y1 }}
              opacity={0.3}
              stroke="#9ca3af"
              strokeDasharray="6,6"
              strokeLinecap="round"
              strokeWidth="3"
              transition={{ damping: 30, stiffness: 300, type: "spring" }}
              x1={linePos.x1}
              x2={linePos.x2}
              y1={linePos.y1}
              y2={linePos.y2}
            />
          </m.svg>
        )}
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
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-1 flex-col justify-center text-center"
              exit={{ opacity: 0, y: -10 }}
              initial={{ opacity: 0, y: 10 }}
              key={selectedService?.title || "default"}
              transition={{ duration: 0.3 }}
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
          <m.div
            className="absolute z-10 flex flex-col items-center"
            custom={{ ...service, shouldReduceMotion }}
            key={service.title}
            onClick={() => layout.isMobile && handleServiceInteraction(service)}
            onHoverEnd={handleServiceLeave}
            onHoverStart={() => !layout.isMobile && handleServiceInteraction(service)}
            ref={(el) => (serviceRefs.current[idx] = el)}
            style={{
              left: "50%",
              top: "50%",
            }}
            variants={itemVariants}
          >
            <button
              aria-label={`Maps to ${service.title} service`}
              className="group flex size-12 cursor-pointer items-center justify-center rounded-full border-2 border-citius-orange bg-brand-light shadow-lg focus:outline-none focus:ring-4 focus:ring-citius-orange/30 md:h-16 md:w-16 lg:h-18 lg:w-18"
              tabIndex={0}
              type="button"
            >
              <service.icon className="size-6 text-citius-blue transition-colors duration-200 group-hover:text-citius-orange md:h-8 md:w-8 lg:h-9 lg:w-9" />
            </button>
            <span
              aria-hidden="true"
              className="mt-2 max-w-[80px] select-none text-center font-medium text-brand-dark text-xs leading-tight md:max-w-[100px] md:text-sm lg:text-base"
            >
              {service.title}
            </span>
          </m.div>
        ))}
      </m.div>
    </div>
  );
}
