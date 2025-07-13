import { Star } from "lucide-react";
import { cn } from "../../utils/cn";
import { motion } from "motion/react";

export default function UspElement({ title, description, className }) {
  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -5 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "flex gap-4 items-start p-6 bg-white rounded-lg border shadow-md transition-all duration-300 border-brand-border/50 hover:shadow-xl hover:border-citius-orange",
        className
      )}
    >
      <motion.div whileHover={{ rotate: 360, scale: 1.2 }} transition={{ duration: 0.5 }}>
        <Star className="w-7 h-7 text-citius-orange" />
      </motion.div>
      <div className="text-left">
        <h4 className="mb-1 text-lg font-semibold text-brand-dark">{title}</h4>
        {description && (
          <p className="text-sm text-brand-muted">{description}</p>
        )}
      </div>
    </motion.div>
  );
}
