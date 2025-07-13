import { Award, Medal, Ribbon, Star, Trophy } from "lucide-react";
import { cn } from "../../utils/cn";
import { motion } from "motion/react";

const awards = [
  {
    title: "National Tourism Award",
    year: "2017-18",
    Icon: Trophy,
  },
  {
    title: "Dubai MICE Silver Award",
    year: "2023-24",
    Icon: Medal,
  },
  {
    title: "Thailand MICE Award",
    year: "2022-23, 2023-24",
    Icon: Star,
  },
  {
    title: "Hong Kong Top MICE Agent Awards",
    year: "2017",
    Icon: Ribbon,
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
  show: { opacity: 1, y: 0, transition: { ease: "easeOut" } },
};

export default function AwardsShowcase({ className }) {
  return (
    <motion.section
      className={cn("py-12 bg-brand-light", className)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={containerVariants}
    >
      <h2 className="justify-center items-center mb-8 text-2xl font-semibold text-center text-brand-dark">
        Recognized for Excellence
      </h2>
      <div className="grid gap-8 px-4 mx-auto max-w-6xl sm:grid-cols-2">
        {awards.map(({ title, year, Icon }) => (
          <motion.div
            key={title}
            className="p-6 text-center bg-white rounded-lg border shadow-sm transition border-brand-border hover:shadow-md"
            variants={itemVariants}
            whileHover={{ scale: 1.05, y: -5 }}
          >
            <motion.div whileHover={{ rotate: 15, scale: 1.1 }}>
              <Icon className="mx-auto mb-4 w-10 h-10 text-citius-orange" />
            </motion.div>
            <h3 className="mb-1 text-lg font-semibold text-brand-dark">
              {title}
            </h3>
            <p className="text-sm text-brand-muted">{year}</p>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
