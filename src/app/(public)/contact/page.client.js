"use client";

import { m } from "motion/react";
import AnimatedSection from "@/components/layout/AnimatedSection";
import LocationCard from "@/components/ui/LocationCard";
import ModernContactForm from "@/components/ui/ModernContactForm";

const offices = [
  {
    address: "1865, Rajdanga Main Rd, Rajdanga, Kasba, Kolkata, West Bengal 700107",
    city: "Kolkata",
    map: "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d7371.453129369134!2d88.38764907014604!3d22.514440031478962!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a02715301f75725%3A0xf1aa2145e95e1dca!2sCitius%20Holidays%20Private%20Limited!5e0!3m2!1sen!2sin!4v1752329121013!5m2!1sen!2sin",
    phone: "+91 98310 82929",
  },
  {
    address: "214 Swastik Plaza, Pokhran Road No 2, Thane West 400610",
    city: "Mumbai",
    map: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3767.508557808548!2d72.972286!3d19.2166556!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7b9424c041a6b%3A0x25adaf1c8857d238!2sSwastik%20Plaza!5e0!3m2!1sen!2sin!4v1751708328548!5m2!1sen!2sin",
    phone: "+91 9920993259",
  },
  {
    address:
      "Pachie's 3rd Floor, Building Number: 982, 3rd Cross Road, Kalyan Nagar, Bengaluru 560043",
    city: "Bengaluru",
    map: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3887.265385803619!2d77.6521246!3d13.0187647!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bae170035730c9f%3A0xc369a6eb1011ce3c!2sPachies!5e0!3m2!1sen!2sin!4v1751708405258!5m2!1sen!2sin",
    phone: "+91 99008 14292",
  },
];

export default function ContactPage() {
  return (
    <>
      <div className="h-19 bg-[#0B1026]" />
      <AnimatedSection className="bg-[url('/gallery/bgfooter.webp')] bg-center px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <m.h1
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 font-bold text-4xl text-citius-blue md:text-5xl"
              initial={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              Get in Touch
            </m.h1>
            <m.p
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto max-w-2xl text-brand-muted text-lg"
              initial={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
            >
              Ready to start your journey? Our team is here to craft unforgettable experiences for
              you.
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
              <ModernContactForm />
            </m.div>

            <div className="order-1 space-y-8 lg:order-2">
              <m.div
                initial={{ opacity: 0, x: 20 }}
                transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
                viewport={{ amount: 0.2, once: true }}
                whileInView={{ opacity: 1, x: 0 }}
              >
                <h2 className="mb-6 font-semibold text-2xl text-citius-blue">Our Offices</h2>
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
                      <LocationCard {...office} index={index} />
                      <div className="mt-4 overflow-hidden rounded-lg border border-brand-border shadow">
                        <iframe
                          allowFullScreen=""
                          className="h-[200px] w-full border-0"
                          height="200"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          sandbox="allow-scripts allow-popups allow-presentation"
                          src={office.map}
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
