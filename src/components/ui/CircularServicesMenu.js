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
import { AnimatePresence, m as motion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const services = [
  {
    title: "MICE",
    icon: Briefcase,
    description: "Meetings, Incentives, Conferences & Exhibitions worldwide.",
    path: "/mice",
  },
  {
    title: "VISA Assistance",
    icon: FileBadge,
    description: "End-to-end visa processing and support services.",
    path: "/services",
  },
  {
    title: "Event Management",
    icon: Users,
    description: "From concept to execution of corporate events.",
    path: "/services",
  },
  {
    title: "International Travel",
    icon: Globe,
    description: "Curated global itineraries and travel experiences.",
    path: "/services",
  },
  {
    title: "Domestic Travel",
    icon: MapPinned,
    description: "Explore India with bespoke domestic journeys.",
    path: "/services",
  },
  {
    title: "Travel Insurance",
    icon: ShieldCheck,
    description: "Comprehensive travel insurance and protection.",
    path: "/services",
  },
  {
    title: "Branding",
    icon: Star,
    description: "Event branding and collateral design services.",
    path: "/services",
  },
  {
    title: "Celebrity Management",
    icon: Medal,
    description: "Book celebrities and performers for events.",
    path: "/services",
  },
  {
    title: "Sporting Events",
    icon: Trophy,
    description: "Access to premier sports hospitality packages.",
    path: "/services",
  },
  {
    title: "Onsite Travel Desk",
    icon: Plane,
    description: "Dedicated travel desks for large corporate events.",
    path: "/services",
  },
  {
    title: "Spiritual Trails",
    icon: Sun,
    description: "Sacred journeys to spiritual destinations worldwide.",
    path: "/pilgrimage",
  },
];

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: {
    opacity: 0,
    scale: 0,
    x: "-50%",
    y: "-50%",
  },
  show: (service) => ({
    opacity: 1,
    scale: 1,
    x: `calc(-50% + ${service.x}px)`,
    y: `calc(-50% + ${service.y}px)`,
    transition: {
      type: "spring",
      damping: 12,
      stiffness: 100,
    },
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
      x,
      y,
      angle,
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
          nextLinePos = { x1: centerX, y1: centerY, x2: serviceX, y2: serviceY };
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
      setSelectedService(service);
    }
  };

  const handleServiceLeave = () => {
    if (!layout.isMobile) {
      setSelectedService(null);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[400px] md:h-[520px] lg:h-[600px] flex items-center justify-center"
    >
      {/* Animated line from center to hovered/tapped service */}
      <AnimatePresence>
        {linePos && (
          <motion.svg
            className="absolute top-0 left-0 size-full pointer-events-none z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.line
              x1={linePos.x1}
              y1={linePos.y1}
              x2={linePos.x2}
              y2={linePos.y2}
              stroke="#9ca3af"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="6,6"
              opacity={0.3}
              initial={{ x2: linePos.x1, y2: linePos.y1 }}
              animate={{ x2: linePos.x2, y2: linePos.y2 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          </motion.svg>
        )}
      </AnimatePresence>
      <motion.div
        className="relative z-20 size-32 md:w-52 md:h-52 pb-8 bg-white rounded-full shadow-2xl border-4 border-citius-blue flex flex-col items-center justify-center px-3"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="flex flex-col items-center justify-center h-auto">
          <div className="flex items-center justify-center mb-1">
            <Image
              src="/gallery/logo.webp"
              alt="Citius Logo"
              width={60}
              height={60}
              className="mx-auto size-12 md:w-20 md:h-20 object-contain"
              style={{ objectFit: "contain" }}
              priority
            />
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedService?.title || "default"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="text-center flex-1 flex flex-col justify-center"
            >
              <h3 className="text-xs md:text-base font-bold text-brand-dark mb-1 leading-tight">
                {selectedService?.title || "Our Services"}
              </h3>
              <p className="text-xs text-brand-muted leading-tight px-1">
                {selectedService?.description ||
                  (layout.isMobile
                    ? "Tap a service to learn more"
                    : "Hover over a service to learn more")}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      <motion.div
        className="absolute inset-0"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {servicePositions.map((service, idx) => (
          <motion.div
            key={service.title}
            ref={(el) => (serviceRefs.current[idx] = el)}
            className="absolute z-10 flex flex-col items-center"
            style={{
              left: "50%",
              top: "50%",
            }}
            variants={itemVariants}
            custom={service}
            onHoverStart={() => !layout.isMobile && handleServiceInteraction(service)}
            onHoverEnd={handleServiceLeave}
            onClick={() => layout.isMobile && handleServiceInteraction(service)}
          >
            <button
              type="button"
              className="size-12 md:w-16 md:h-16 lg:w-18 lg:h-18 bg-brand-light rounded-full shadow-lg border-2 border-citius-orange flex items-center justify-center cursor-pointer group focus:outline-none focus:ring-4 focus:ring-citius-orange/30"
              tabIndex={0}
              aria-label={`Maps to ${service.title} service`}
            >
              <service.icon className="size-6 md:w-8 md:h-8 lg:w-9 lg:h-9 text-citius-blue group-hover:text-citius-orange transition-colors duration-200" />
            </button>
            <span
              className="mt-2 text-xs md:text-sm lg:text-base text-brand-dark font-medium text-center max-w-[80px] md:max-w-[100px] leading-tight select-none"
              aria-hidden="true"
            >
              {service.title}
            </span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
