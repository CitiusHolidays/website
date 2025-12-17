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
      className={cn(
        "py-20 bg-gradient-to-br from-citius-blue to-brand-dark text-white",
        className
      )}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={containerVariants}
    >
      <div className="px-4 mx-auto max-w-7xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold md:text-4xl mb-4">
            Recognized for Excellence
          </h2>
          <p className="text-brand-light/80 max-w-2xl mx-auto text-lg">
            Our commitment to quality and service has been acknowledged by
            industry leaders worldwide.
          </p>
        </motion.div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {awards.map(({ title, year, Icon }) => (
            <motion.div
              key={title}
              className="p-8 text-center bg-white rounded-xl shadow-xl hover:shadow-2xl transition-shadow duration-300"
              variants={itemVariants}
              whileHover={{ scale: 1.05, y: -5 }}
            >
              <motion.div
                whileHover={{ rotate: 15, scale: 1.1 }}
                className="inline-block p-3 mb-4 rounded-full bg-brand-light"
              >
                <Icon className="w-10 h-10 text-citius-orange" />
              </motion.div>
              <h3 className="mb-2 text-lg font-bold text-brand-dark leading-tight">
                {title}
              </h3>
              <p className="text-sm font-medium text-brand-muted">{year}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
