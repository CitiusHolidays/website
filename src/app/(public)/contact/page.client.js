"use client";

import LocationCard from "@/components/ui/LocationCard";
import ModernContactForm from "@/components/ui/ModernContactForm";
import { getPublicOffices } from "@/data/publicContacts";
import { getContactIntentPrefill } from "@/lib/public/contactIntent";

const offices = getPublicOffices("contact");

export default function ContactPage({ contactIntent = null, destination = "" }) {
  const initialValues = getContactIntentPrefill(contactIntent, destination);

  return (
    <>
      <div className="h-19 bg-public-night" />
      <section className="bg-[url('/gallery/bgfooter.webp')] bg-center px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h1 className="public-enter mb-4 font-bold font-heading text-4xl text-public-blue md:text-5xl">
              Get in Touch
            </h1>
            <p className="public-enter mx-auto max-w-2xl text-lg text-public-muted [--public-enter-delay:60ms]">
              Tell us your dates, group size, and destination. A Citius specialist will respond
              within two business days.
            </p>
          </div>

          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="public-enter [--public-enter-delay:120ms]">
              <ModernContactForm initialValues={initialValues} />
            </div>

            <div className="space-y-8">
              <div className="public-enter [--public-enter-delay:120ms]">
                <h2 className="mb-6 font-heading font-semibold text-2xl text-public-blue">
                  Our Offices
                </h2>
                <div className="space-y-8">
                  {offices.map((office, index) => (
                    <div key={office.city}>
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
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
