"use client";

import AnimatedSection from "@/components/layout/AnimatedSection";
import LocationCard from "@/components/ui/LocationCard";
import ModernContactForm from "@/components/ui/ModernContactForm";
import { getPublicOffices } from "@/data/publicContacts";

const offices = getPublicOffices("contact");

export default function ContactPage({ initialValues }) {
  return (
    <>
      <div className="h-19 bg-public-night" />
      <AnimatedSection className="bg-[url('/gallery/bgfooter.webp')] bg-center px-4 py-8 md:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 md:mb-12">
            <h1 className="mb-3 font-bold font-heading text-3xl text-public-blue sm:text-4xl md:text-5xl">
              Get in Touch
            </h1>
            <p className="max-w-2xl text-public-muted leading-7 md:text-lg">
              Tell us your dates, group size, and destination. A Citius specialist will respond
              within two business days.
            </p>
          </div>

          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <ModernContactForm initialValues={initialValues} />

            <section aria-labelledby="contact-offices-title">
              <h2
                className="mb-6 font-heading font-semibold text-2xl text-public-blue"
                id="contact-offices-title"
              >
                Our Offices
              </h2>
              <div className="space-y-5">
                {offices.map((office, index) => (
                  <LocationCard
                    address={office.address.contact}
                    city={office.city}
                    dialPhone={office.dialPhone}
                    index={index}
                    key={office.city}
                    mapUrl={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(office.address.contact)}`}
                    phone={office.displayPhone}
                  />
                ))}
              </div>
            </section>
          </div>
        </div>
      </AnimatedSection>
    </>
  );
}
