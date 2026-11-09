import { Medal, Ribbon, Star, Trophy } from "lucide-react";
import { m } from "motion/react";
import { PUBLIC_EASE_OUT } from "@/lib/publicInteractionMotion";
import { useHydrationSafeReducedMotion } from "@/lib/useHydrationSafeReducedMotion";
import { cn } from "@/lib/utils";

const awards = [
  {
    Icon: Trophy,
    title: "National Tourism Award",
    year: "2017-18",
  },
  {
    Icon: Medal,
    title: "Dubai MICE Silver Award",
    year: "2023-24",
  },
  {
    Icon: Star,
    title: "Thailand MICE Award",
    year: "2022-23, 2023-24",
  },
  {
    Icon: Ribbon,
    title: "Hong Kong Top MICE Agent Awards",
    year: "2017",
  },
];

// Home already reveals this module through AnimatedSection, so only the cards keep a short stagger.
const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

// `y` (not a transform string) because the cards also lift with whileHover's `y`/`scale`.
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, transition: { duration: 0.35, ease: PUBLIC_EASE_OUT }, y: 0 },
};

export default function AwardsShowcase({ className }) {
  const shouldReduceMotion = useHydrationSafeReducedMotion();

  return (
    <m.section
      className={cn("bg-gradient-to-br from-citius-blue to-brand-dark py-20 text-white", className)}
      initial={shouldReduceMotion ? false : "hidden"}
      variants={containerVariants}
      viewport={{ amount: 0.2, once: true }}
      whileInView="show"
    >
      <div className="mx-auto max-w-7xl px-4 text-center">
        <div className="mb-12">
          <h2 className="mb-4 font-bold text-3xl md:text-4xl">Industry Recognition</h2>
          <p className="mx-auto max-w-2xl text-brand-light/80 text-lg">
            Citius has received awards from IATO, TAAI, and other travel industry bodies.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {awards.map(({ title, year, Icon }) => (
            <m.div
              className="rounded-xl bg-white p-8 text-center shadow-xl transition-shadow duration-300 hover:shadow-2xl"
              key={title}
              variants={itemVariants}
              whileHover={{ scale: 1.05, y: -5 }}
            >
              <m.div
                className="mb-4 inline-block rounded-full bg-brand-light p-3"
                whileHover={{ rotate: 15, scale: 1.1 }}
              >
                <Icon className="size-10 text-public-orange-ink" />
              </m.div>
              <h3 className="mb-2 font-bold text-brand-dark text-lg leading-tight">{title}</h3>
              <p className="font-medium text-brand-muted text-sm">{year}</p>
            </m.div>
          ))}
        </div>
      </div>
    </m.section>
  );
}
