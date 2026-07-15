"use client";

import { Quote, Star } from "lucide-react";
import { m } from "motion/react";
import { kailashTestimonials } from "../../data/trails";
import { cn } from "../../utils/cn";

function TestimonialCard({ testimonial, index }) {
  return (
    <m.div
      className="group relative"
      initial={{ opacity: 0, y: 30 }}
      transition={{ delay: index * 0.15, duration: 0.6, ease: "easeOut" }}
      viewport={{ margin: "-50px", once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <div className="relative flex h-full flex-col rounded-2xl border border-brand-light/50 bg-white p-6 shadow-brand-dark/5 shadow-lg transition-[border-color,box-shadow] duration-500 hover:border-citius-orange/20 hover:shadow-brand-dark/10 hover:shadow-xl md:rounded-3xl md:p-10">
        {/* Quote Icon */}
        <div className="absolute -top-4 -left-2 flex size-10 items-center justify-center rounded-full bg-citius-orange shadow-lg md:-top-5 md:-left-3 md:h-12 md:w-12">
          <Quote className="size-4 text-white md:h-5 md:w-5" />
        </div>

        {/* Rating */}
        <div className="mb-4 ml-4 flex gap-1 md:mb-6">
          {Array.from({ length: testimonial.rating }, (_, i) => `star-${i + 1}`).map((starKey) => (
            <Star
              className="size-3.5 fill-citius-orange text-citius-orange md:h-4 md:w-4"
              key={starKey}
            />
          ))}
        </div>

        {/* Quote Text */}
        <blockquote className="mb-6 flex-grow font-sans text-base text-brand-dark/90 leading-relaxed md:mb-8 md:text-lg">
          &ldquo;{testimonial.quote}&rdquo;
        </blockquote>

        {/* Author Info */}
        <div className="flex items-center gap-3 border-brand-light border-t pt-4 md:gap-4 md:pt-6">
          {/* Avatar Placeholder */}
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-citius-blue to-citius-blue/70 md:h-14 md:w-14">
            <span className="font-heading font-semibold text-base text-white md:text-lg">
              {testimonial.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </span>
          </div>

          <div className="min-w-0">
            <p className="truncate font-heading font-semibold text-citius-blue text-sm md:text-base">
              {testimonial.name}
            </p>
            <p className="text-brand-muted text-xs md:text-sm">{testimonial.location}</p>
            <p className="mt-0.5 text-citius-orange/80 text-xs">{testimonial.journey}</p>
          </div>
        </div>

        {/* Decorative Element */}
        <div className="pointer-events-none absolute right-0 bottom-0 h-24 w-24 rounded-tr-2xl rounded-bl-2xl bg-gradient-to-tl from-citius-orange/5 to-transparent md:h-32 md:w-32 md:rounded-tr-3xl md:rounded-bl-3xl" />
      </div>
    </m.div>
  );
}

export default function TestimonialsSection({ className }) {
  return (
    <section className={cn("bg-[#f8f5f2] py-16 md:py-32", className)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <m.div
          className="mb-12 text-center md:mb-20"
          initial={{ opacity: 0, y: 20 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <span className="mb-4 block font-heading text-citius-orange text-xs uppercase tracking-[0.3em] md:text-sm">
            Traveller Stories
          </span>
          <h2 className="mb-4 font-heading text-3xl text-brand-dark leading-tight md:mb-6 md:text-5xl">
            Voices from the <span className="text-citius-blue italic">Sacred Path</span>
          </h2>
          <p className="mx-auto max-w-2xl font-sans text-base text-brand-muted leading-relaxed md:text-xl">
            Hear from yatris who have experienced the transformation. Their journeys inspire our
            commitment to excellence.
          </p>
          <div className="mx-auto mt-6 h-px w-16 bg-citius-orange/30 md:mt-8 md:w-24" />
        </m.div>

        {/* Testimonials Grid */}
        <div className="grid gap-6 md:grid-cols-2 md:gap-8">
          {kailashTestimonials.map((testimonial, index) => (
            <TestimonialCard index={index} key={testimonial.id} testimonial={testimonial} />
          ))}
        </div>

        {/* Bottom CTA */}
        <m.div
          className="mt-12 text-center md:mt-16"
          initial={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.4 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <p className="mb-6 font-sans text-base text-brand-muted md:text-lg">
            Join hundreds of fulfilled yatris who have made this sacred journey with us.
          </p>
          <a
            className="inline-flex items-center gap-2 rounded-full bg-citius-blue px-8 py-3.5 font-heading text-sm text-white tracking-wider shadow-citius-blue/20 shadow-lg transition-[translate,background-color] duration-300 fine-hover:hover:-translate-y-0.5 hover:bg-citius-blue/90"
            href="#journey-details"
          >
            Begin Your Journey
          </a>
        </m.div>
      </div>
    </section>
  );
}
