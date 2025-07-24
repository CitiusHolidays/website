"use client";

import { motion } from "motion/react";
import AnimatedSection from "../../components/layout/AnimatedSection";
import LocationCard from "../../components/ui/LocationCard";
import ModernContactForm from "../../components/ui/ModernContactForm";

const offices = [
  {
    city: "Kolkata",
    address:
      "1865, Rajdanga Main Rd, Rajdanga, Kasba, Kolkata, West Bengal 700107",
    phone: "+91 98310 82929",
    map: "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d7371.453129369134!2d88.38764907014604!3d22.514440031478962!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a02715301f75725%3A0xf1aa2145e95e1dca!2sCitius%20Holidays%20Private%20Limited!5e0!3m2!1sen!2sin!4v1752329121013!5m2!1sen!2sin"
  },
  {
    city: "Mumbai",
    address: "214 Swastik Plaza, Pokhran Road No 2, Thane West 400610",
    phone: "+91 9920993259",
    map: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3767.508557808548!2d72.972286!3d19.2166556!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7b9424c041a6b%3A0x25adaf1c8857d238!2sSwastik%20Plaza!5e0!3m2!1sen!2sin!4v1751708328548!5m2!1sen!2sin",
  },
  {
    city: "Bengaluru",
    address:
      "Pachie's 3rd Floor, Building Number: 982, 3rd Cross Road, Kalyan Nagar, Bengaluru 560043",
    phone: "+91 99008 14292",
    map: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3887.265385803619!2d77.6521246!3d13.0187647!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bae170035730c9f%3A0xc369a6eb1011ce3c!2sPachies!5e0!3m2!1sen!2sin!4v1751708405258!5m2!1sen!2sin",
  },
];

export default function ContactPage() {
  return (
    <AnimatedSection className="py-16 bg-gradient-to-b from-brand-light to-white px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-4xl md:text-5xl font-bold text-citius-blue mb-4"
          >
            Get in Touch
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="text-brand-muted max-w-2xl mx-auto text-lg"
          >
            Ready to start your journey? Our team is here to craft unforgettable
            experiences for you.
          </motion.p>
        </div>

        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            className="order-2 lg:order-1"
          >
            <ModernContactForm />
          </motion.div>

          <div className="order-1 lg:order-2 space-y-8">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            >
              <h2 className="text-2xl font-semibold text-citius-blue mb-6">
                Our Offices
              </h2>
              <motion.div
                className="space-y-8"
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.2 }}
                variants={{
                  show: { transition: { staggerChildren: 0.2 } },
                }}
              >
                {offices.map((office, index) => (
                  <motion.div
                    key={office.city}
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      show: { opacity: 1, y: 0 },
                    }}
                  >
                    <LocationCard {...office} index={index} />
                    <div className="mt-4 rounded-lg border border-brand-border shadow overflow-hidden">
                      <iframe
                        title={`${office.city} map`}
                        src={office.map}
                        width="100%"
                        height="200"
                        loading="lazy"
                        className="w-full h-[200px] border-0"
                        style={{ minHeight: 180 }}
                        allowFullScreen=""
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}
