"use client";

import { motion } from "motion/react";
import { Quote, Star } from "lucide-react";
import { kailashTestimonials } from "../../data/trails";
import { cn } from "../../utils/cn";

function TestimonialCard({ testimonial, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay: index * 0.15, ease: "easeOut" }}
      className="group relative"
    >
      <div className="relative bg-white rounded-2xl md:rounded-3xl p-6 md:p-10 shadow-lg shadow-brand-dark/5 border border-brand-light/50 hover:shadow-xl hover:shadow-brand-dark/10 hover:border-citius-orange/20 transition-all duration-500 h-full flex flex-col">
        {/* Quote Icon */}
        <div className="absolute -top-4 -left-2 md:-top-5 md:-left-3 w-10 h-10 md:w-12 md:h-12 bg-citius-orange rounded-full flex items-center justify-center shadow-lg">
          <Quote className="w-4 h-4 md:w-5 md:h-5 text-white" />
        </div>

        {/* Rating */}
        <div className="flex gap-1 mb-4 md:mb-6 ml-4">
          {[...Array(testimonial.rating)].map((_, i) => (
            <Star key={i} className="w-3.5 h-3.5 md:w-4 md:h-4 fill-citius-orange text-citius-orange" />
          ))}
        </div>

        {/* Quote Text */}
        <blockquote className="font-sans text-base md:text-lg text-brand-dark/90 leading-relaxed mb-6 md:mb-8 flex-grow">
          &ldquo;{testimonial.quote}&rdquo;
        </blockquote>

        {/* Author Info */}
        <div className="flex items-center gap-3 md:gap-4 pt-4 md:pt-6 border-t border-brand-light">
          {/* Avatar Placeholder */}
          <div className="w-11 h-11 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-citius-blue to-citius-blue/70 flex items-center justify-center shrink-0">
            <span className="font-heading text-white font-semibold text-base md:text-lg">
              {testimonial.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </span>
          </div>

          <div className="min-w-0">
            <p className="font-heading text-sm md:text-base font-semibold text-citius-blue truncate">
              {testimonial.name}
            </p>
            <p className="text-xs md:text-sm text-brand-muted">
              {testimonial.location}
            </p>
            <p className="text-xs text-citius-orange/80 mt-0.5">
              {testimonial.journey}
            </p>
          </div>
        </div>

        {/* Decorative Element */}
        <div className="absolute bottom-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-gradient-to-tl from-citius-orange/5 to-transparent rounded-tr-2xl md:rounded-tr-3xl rounded-bl-2xl md:rounded-bl-3xl pointer-events-none" />
      </div>
    </motion.div>
  );
}

export default function TestimonialsSection({ className }) {
  return (
    <section className={cn("py-16 md:py-32 bg-[#f8f5f2]", className)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 md:mb-20"
        >
          <span className="font-heading text-citius-orange text-xs md:text-sm tracking-[0.3em] uppercase mb-4 block">
            Traveller Stories
          </span>
          <h2 className="font-heading text-3xl md:text-5xl text-brand-dark mb-4 md:mb-6 leading-tight">
            Voices from the <span className="text-citius-blue italic">Sacred Path</span>
          </h2>
          <p className="font-sans text-base md:text-xl text-brand-muted max-w-2xl mx-auto leading-relaxed">
            Hear from yatris who have experienced the transformation. Their journeys inspire our commitment to excellence.
          </p>
          <div className="w-16 md:w-24 h-px bg-citius-orange/30 mx-auto mt-6 md:mt-8" />
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {kailashTestimonials.map((testimonial, index) => (
            <TestimonialCard
              key={testimonial.id}
              testimonial={testimonial}
              index={index}
            />
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-12 md:mt-16 text-center"
        >
          <p className="font-sans text-base md:text-lg text-brand-muted mb-6">
            Join hundreds of fulfilled yatris who have made this sacred journey with us.
          </p>
          <a
            href="#journey-details"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-citius-blue text-white font-heading tracking-wider text-sm rounded-full hover:bg-citius-blue/90 hover:-translate-y-0.5 transition-all duration-300 shadow-lg shadow-citius-blue/20"
          >
            Begin Your Journey
          </a>
        </motion.div>
      </div>
    </section>
  );
}
