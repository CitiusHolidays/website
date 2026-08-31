"use client";

import { m } from "motion/react";
import AnimatedSection from "@/components/layout/AnimatedSection";
import LocationCard from "@/components/ui/LocationCard";
import ModernContactForm from "@/components/ui/ModernContactForm";
import { getPublicOffices } from "@/data/publicContacts";

const offices = getPublicOffices("contact");

export default function ContactPage({ initialValues }) {
  return (
    <>
      <div className="h-19 bg-public-night" />
      <AnimatedSection className="bg-[url('/gallery/bgfooter.webp')] bg-center px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <m.h1
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 font-bold font-heading text-4xl text-public-blue md:text-5xl"
              initial={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              Get in Touch
            </m.h1>
            <m.p
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto max-w-2xl text-lg text-public-muted"
              initial={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
            >
              Tell us your dates, group size, and destination. A Citius specialist will respond
              within two business days.
            </m.p>
          </div>

          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <m.div
              className="order-2 lg:order-1"
              initial={{ opacity: 0, x: -20 }}
              transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
              viewport={{ amount: 0.2, once: true }}
              whileInView={{ opacity: 1, x: 0 }}
            >
              <ModernContactForm initialValues={initialValues} />
            </m.div>

            <div className="order-1 space-y-8 lg:order-2">
              <m.div
                initial={{ opacity: 0, x: 20 }}
                transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
                viewport={{ amount: 0.2, once: true }}
                whileInView={{ opacity: 1, x: 0 }}
              >
                <h2 className="mb-6 font-heading font-semibold text-2xl text-public-blue">
                  Our Offices
                </h2>
                <m.div
                  className="space-y-8"
                  initial="hidden"
                  variants={{
                    show: { transition: { staggerChildren: 0.2 } },
                  }}
                  viewport={{ amount: 0.2, once: true }}
                  whileInView="show"
                >
                  {offices.map((office, index) => (
                    <m.div
                      key={office.city}
                      variants={{
                        hidden: { opacity: 0, y: 20 },
                        show: { opacity: 1, y: 0 },
                      }}
                    >
                      <LocationCard
                        address={office.address.contact}
                        city={office.city}
                        dialPhone={office.dialPhone}
                        index={index}
                        phone={office.displayPhone}
                      />
                      <div className="mt-4 overflow-hidden rounded-lg border border-brand-border shadow">
                        <iframe
                          allowFullScreen=""
                          className="h-[200px] w-full border-0"
                          height="200"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          sandbox="allow-scripts allow-popups allow-presentation"
                          src={office.mapEmbedUrl}
                          style={{ minHeight: 180 }}
                          title={`${office.city} map`}
                          width="100%"
                        />
                      </div>
                    </m.div>
                  ))}
                </m.div>
              </m.div>
            </div>
          </div>
        </div>
      </AnimatedSection>
    </>
  );
}
