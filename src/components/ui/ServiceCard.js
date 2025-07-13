"use client";
import { motion } from "motion/react";
import { cn } from "../../utils/cn";

export default function ServiceCard({
  title,
  icon: Icon,
  description,
  className,
  ...props
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      whileHover={{ y: -6, boxShadow: "0 20px 30px rgba(0,0,0,0.1)" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "overflow-hidden relative p-8 rounded-xl border backdrop-blur-md group border-brand-border bg-brand-light hover:border-citius-orange",
        className
      )}
      {...props}
    >
      {Icon && (
        <motion.div whileHover={{ scale: 1.1, rotate: -5 }}>
          <Icon className="mb-5 w-12 h-12 transition-colors duration-200 text-citius-blue group-hover:text-citius-orange" />
        </motion.div>
      )}
      <h3 className="mb-3 text-xl font-semibold transition-colors duration-200 text-brand-dark group-hover:text-citius-orange">
        {title}
      </h3>
      {description && (
        <p className="text-sm leading-relaxed text-brand-muted">
          {description}
        </p>
      )}
    </motion.div>
  );
}
