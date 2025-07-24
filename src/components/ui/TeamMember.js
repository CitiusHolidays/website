"use client";

import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function TeamMember({ member, index }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const collapsedHeight = "60px";

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{
        duration: 0.6,
        delay: index * 0.1,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="bg-white rounded-xl shadow-lg overflow-hidden group hover:shadow-2xl transition-shadow duration-300"
    >
      <div className="relative h-80 bg-gradient-to-br from-citius-blue to-citius-orange">
        {member.image ? (
          <Image
            src={member.image}
            alt={member.name}
            fill
            className="object-cover object-center"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-4xl font-bold text-brand-light">
                {member.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-6">
        <motion.h3 
          className={`${
            member.name.length > 16 ? "text-lg" : "text-xl"
          } font-bold text-brand-dark mb-1`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.1 + 0.3 }}
        >
          {member.name}
        </motion.h3>
        <motion.p 
          className="text-citius-orange font-medium mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.1 + 0.4 }}
        >
          {member.position}
        </motion.p>
        
        <div className="relative">
          <motion.div
            animate={{ height: isExpanded ? "auto" : collapsedHeight }}
            className="overflow-hidden relative"
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-sm text-brand-muted leading-relaxed">
              {member.bio}
            </p>
          </motion.div>
          
          {member.bio.length > 200 && (
            <motion.button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-3 flex items-center gap-1 text-citius-blue hover:text-citius-orange transition-colors text-sm font-medium"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span>{isExpanded ? "Show Less" : "Read More"}</span>
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <ChevronDown className="w-4 h-4" />
              </motion.div>
            </motion.button>
          )}
        </div>
        
        <AnimatePresence>
          {isExpanded && member.quote && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: 10 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: 10 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="mt-4 pt-4 border-t border-brand-border overflow-hidden"
            >
              <p className="text-sm italic text-brand-muted">
                &quot;{member.quote}&quot;
              </p>
              {member.quoteAuthor && (
                <p className="text-xs text-brand-muted mt-1">
                  — {member.quoteAuthor}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}