import { Medal, Ribbon, Star, Trophy } from "lucide-react";
import { m } from "motion/react";
import { cn } from "../../utils/cn";

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

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, transition: { ease: "easeOut" }, y: 0 },
};

export default function AwardsShowcase({ className }) {
  return (
    <m.section
      className={cn("bg-gradient-to-br from-citius-blue to-brand-dark py-20 text-white", className)}
      initial="hidden"
      variants={containerVariants}
      viewport={{ amount: 0.2, once: true }}
      whileInView="show"
    >
      <div className="mx-auto max-w-7xl px-4 text-center">
        <m.div
          className="mb-12"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <h2 className="mb-4 font-bold text-3xl md:text-4xl">Recognized for Excellence</h2>
          <p className="mx-auto max-w-2xl text-brand-light/80 text-lg">
            Our commitment to quality and service has been acknowledged by industry leaders
            worldwide.
          </p>
        </m.div>

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
                <Icon className="size-10 text-citius-orange" />
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
