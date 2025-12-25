"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useState, useRef } from "react";
import { ArrowRight, CreditCard, FileText, Shield, Mail, Phone, MapPin } from "lucide-react";

const billingPolicy = {
  title: "Billing & Payment Policy",
  lastUpdated: "January 2025",
  content: [
    {
      heading: "1. General Policy",
      text: "Citius Holidays offers online and offline payment options for booking holiday packages, MICE events, and related travel services. By making a booking and/or completing a payment, the customer agrees to the terms outlined in this Billing & Payment Gateway Policy."
    },
    {
      heading: "2. Accepted Payment Methods",
      text: "Payments can be made using:",
      list: [
        "Credit Cards (Visa, MasterCard, Rupay)",
        "Debit Cards (All major banks)",
        "Net Banking (Indian banks)",
        "UPI (Google Pay, PhonePe, Paytm, etc.)",
        "Wallets (as enabled by gateway)",
        "International Cards (where permitted)",
        "Bank Transfer (NEFT/RTGS/IMPS)"
      ],
      footer: "All online transactions are processed securely through our integrated payment gateway partner."
    },
    {
      heading: "3. Booking Confirmation & Invoicing",
      list: [
        "A booking is considered confirmed only after the payment is successfully received.",
        "Customers will receive: System-generated payment receipt, A booking confirmation email, A tax invoice within 48 hours (GST applicable)",
        "If payment fails or is incomplete, Citius Holidays is not obligated to hold or confirm any service."
      ]
    },
    {
      heading: "4. Advance Payment Requirements",
      subsections: [
        {
          title: "Retail & Family Travel Packages",
          list: [
            "Minimum 50% advance is required to block bookings. (Excluding airfare)",
            "Balance payment must be completed 15–30 days before travel, depending on the destination."
          ]
        },
        {
          title: "Corporate / MICE Bookings",
          list: [
            "As per contract terms, typically: 50% advance to initiate bookings, 100% payment before travel commencement"
          ]
        },
        {
          title: "Fixed Departure Programs",
          list: [
            "Guests may choose: Full Payment, or Advance Payment (as displayed on the package page)"
          ]
        }
      ],
      footer: "If the balance is not paid by the due date, Citius may release bookings without refund of the advance."
    },
    {
      heading: "5. Payment Gateway Charges",
      list: [
        "Citius Holidays does not charge extra for payments made via UPI or Net Banking.",
        "Some gateways may levy a small fee for Credit card /international cards or corporate cards—this will be displayed before checkout.",
        "All charges are governed by the gateway provider’s policy."
      ]
    },
    {
      heading: "6. Refunds & Cancellations",
      list: [
        "Refund timelines follow our Cancellation Policy and depend on suppliers (airlines, hotels, ground partners).",
        "Refunds will be processed: Back to the original payment method, Within 7–14 working days after supplier confirmation",
        "Payment gateway fees (if any) are non-refundable as per gateway rules."
      ]
    },
    {
      heading: "7. Failed or Reversed Transactions",
      text: "In case of: Payment failure, Double charge, Gateway timeout.",
      footer: "Please share proof of transaction (screenshot / reference number). Our team will coordinate with the payment gateway; resolution may take 3–5 working days."
    },
    {
      heading: "8. Security & Data Protection",
      list: [
        "All financial transactions are encrypted through PCI-DSS compliant payment gateways.",
        "Citius Holidays does not store card details on its servers.",
        "Customer personal data is handled as per our Privacy Policy."
      ]
    },
    {
      heading: "9. Dispute Resolution",
      text: "Any payment-related disputes must be emailed to: info@citiusholidays.com",
      list: ["Please mention: Booking ID, Payment reference number, Issue screenshot"],
      footer: "Our finance team will respond within 24–48 hours."
    },
    {
      heading: "10. Contact for Billing Queries",
      contact: {
        team: "Citius Holidays – Accounts Team",
        email: "info@citiusholidays.com",
        phone: "+91 98304 28789",
        address: "Head Office: Kolkata, India"
      }
    }
  ]
};

const termsPolicy = {
  title: "Terms & Conditions",
  lastUpdated: "January 2025",
  intro: "Welcome to Citius Holidays. By accessing our website, booking a service, or engaging with our travel programs, you agree to the following Terms & Conditions. Please read them carefully before proceeding.",
  content: [
    {
      heading: "1. GENERAL TERMS",
      list: [
        "These Terms & Conditions govern all bookings made through Citius Holidays (hereafter referred to as “Citius”, “we”, “us”, or “our”).",
        "By making a booking, the customer (“you”, “guest”, “traveller”, “participant”) confirms that they have read, understood, and accepted these terms.",
        "Citius acts as a facilitator of travel services and works with third-party suppliers such as airlines, hotels, DMCs, event partners, transport companies, etc.",
        "All services are subject to availability at the time of booking."
      ]
    },
    {
      heading: "2. BOOKING & PAYMENT",
      list: [
        "A booking is considered confirmed only after receipt of the required advance payment.",
        "Full payment must be made within the timelines specified in the itinerary or invoice.",
        "In case of non-payment, Citius reserves the right to release bookings without notice.",
        "For corporate/MICE programs, payment schedules will follow the contract terms.",
        "Payments can be made through approved channels: bank transfer, UPI, payment gateway, cards, etc."
      ]
    },
    {
      heading: "3. PRICING & INCLUSIONS",
      list: [
        "Prices are calculated based on prevailing exchange rates, flight fares, taxes, and supplier costs at the time of quotation.",
        "Prices may change due to fluctuations in: Currency exchange, Airline fare revisions, Fuel surcharges, Government taxes, Seasonal demand",
        "Package prices generally include items mentioned in the itinerary only. Any addition or deviation will incur extra charges."
      ]
    },
    {
      heading: "4. CANCELLATION POLICY",
      text: "Cancellation charges apply as per the schedule mentioned in your itinerary or invoice. Typical structure:",
      list: [
        "Airline tickets: As per airline policy (non-refundable fares may apply).",
        "Hotels / DMC services: As per supplier cancellation rules.",
        "Citius service fee: Non-refundable."
      ],
      footer: "No refund is provided for: No-show, Unused services, Early check-out, Missed tours due to delays or personal reasons"
    },
    {
      heading: "5. REFUND PROCESS",
      list: [
        "All refunds are processed only after receiving confirmation from the respective suppliers.",
        "Refunds will be returned to the original mode of payment.",
        "Processing time: 7–14 working days (may vary based on airline/hotel response).",
        "Payment gateway fees (if applicable) are non-refundable."
      ]
    },
    {
      heading: "6. TRAVEL DOCUMENTS & VISA",
      list: [
        "Guests are responsible for carrying valid passports, visas, identity proof, and travel documents.",
        "Citius can assist with visa documentation, but approval is solely at the discretion of the respective consulates.",
        "No refund is applicable for rejection or delays caused by authorities."
      ]
    },
    {
      heading: "7. TRAVEL INSURANCE",
      list: [
        "Citius strongly recommends comprehensive travel insurance for all guests.",
        "For corporate groups, insurance may be included as part of the program—subject to contract."
      ]
    },
    {
      heading: "8. HEALTH, SAFETY & CONDUCT",
      list: [
        "Guests must ensure they are medically fit to travel.",
        "Any pre-existing health condition must be disclosed to Citius.",
        "Citius is not liable for: Accidents, Illness, Loss of personal belongings, Delays caused by weather, strikes, political unrest, or natural disasters",
        "Misconduct or violation of local rules may lead to removal from the tour at the traveller’s cost."
      ]
    },
    {
      heading: "9. FORCE MAJEURE",
      text: "Citius is not responsible for any disruption due to circumstances beyond our control, including: Natural calamities, Pandemics, Flight cancellations or diversions, Government restrictions, War, strikes, riots, Weather issues, Border/visa delays.",
      footer: "Under such scenarios, refunds or rescheduling will follow supplier policies only."
    },
    {
      heading: "10. CHANGES & AMENDMENTS",
      list: [
        "Any changes requested after booking (date change, name change, accommodation upgrade, etc.) are subject to availability and additional costs.",
        "Citius reserves the right to modify itineraries due to operational constraints, safety concerns, or supplier limitations."
      ]
    },
    {
      heading: "11. LIMITATION OF LIABILITY",
      text: "Citius operates as a travel planner and coordinator. We are not liable for: Service lapses by airlines, hotels, transporters, or third-party vendors; Losses due to delays, cancellations, or unforeseen circumstances; Acts of negligence by external vendors.",
      footer: "Our liability is limited to the amount paid to Citius for the specific service."
    },
    {
      heading: "12. WEBSITE USAGE",
      list: [
        "All content on citiusholidays.com is proprietary and protected by copyright.",
        "Users may not copy, duplicate, or misuse website material.",
        "Citius is not responsible for third-party links, inaccuracies, or website downtime."
      ]
    },
    {
      heading: "13. PRIVACY & DATA SECURITY",
      list: [
        "Customer data is protected under our Privacy Policy.",
        "Payment details are handled securely via PCI-DSS compliant payment gateways.",
        "Citius does not store card information."
      ]
    },
    {
      heading: "14. GOVERNING LAW",
      text: "These Terms & Conditions are governed by the laws of India, and any dispute shall be subject to the exclusive jurisdiction of courts in Mumbai."
    },
    {
      heading: "15. CONTACT INFORMATION",
      contact: {
        team: "Citius Holidays – Customer Support",
        email: "info@citiusholidays.com",
        phone: "+91 90387 65012"
      }
    }
  ]
};

const Section = ({ data }) => (
  <div
    className="mb-10 last:mb-0"
  >
    <h3 className="font-heading font-semibold text-xl mb-4 text-citius-blue">{data.heading}</h3>
    {data.text && <p className="mb-4 text-gray-700 leading-relaxed font-content">{data.text}</p>}
    
    {data.subsections && (
      <div className="space-y-4 mb-4">
        {data.subsections.map((sub, i) => (
          <div key={i} className="bg-gray-50 p-4 rounded-lg border-l-4 border-citius-orange">
            <h4 className="font-semibold text-gray-900 mb-2">{sub.title}</h4>
            <ul className="space-y-2">
              {sub.list.map((item, j) => (
                <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-citius-orange shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    )}

    {data.list && (
      <ul className="space-y-3 mb-4">
        {data.list.map((item, i) => (
          <li key={i} className="flex items-start gap-3 group">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-citius-blue group-hover:bg-citius-orange transition-colors duration-300 shrink-0" />
            <span className="text-gray-700 font-content group-hover:text-gray-900 transition-colors duration-300">{item}</span>
          </li>
        ))}
      </ul>
    )}
    
    {data.footer && (
      <p className="text-sm text-gray-500 italic border-l-2 border-gray-300 pl-4 py-1">{data.footer}</p>
    )}

    {data.contact && (
      <div className="bg-brand-dark text-white p-6 rounded-xl mt-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-citius-orange/20 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-citius-orange/30 transition-all duration-500" />
        <h4 className="font-semibold text-lg mb-4 relative z-10">{data.contact.team}</h4>
        <div className="space-y-3 relative z-10 text-sm">
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-citius-orange" />
            <a href={`mailto:${data.contact.email}`} className="hover:text-citius-orange transition-colors">{data.contact.email}</a>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-citius-orange" />
            <a href={`tel:${data.contact.phone.replace(/\s/g, '')}`} className="hover:text-citius-orange transition-colors">{data.contact.phone}</a>
          </div>
          {data.contact.address && (
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-citius-orange" />
              <span>{data.contact.address}</span>
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);

export default function PolicyContent() {
  const [activeTab, setActiveTab] = useState("terms");
  const { scrollYProgress } = useScroll();
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <div className="min-h-screen bg-[#FDFBF7]"> {/* Off-white paper color */}
      {/* Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-citius-orange z-50 origin-left"
        style={{ scaleX }}
      />

      {/* Header */}
      <header className="relative bg-brand-dark text-white pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/gallery/bgaboutus.png')] bg-cover bg-center opacity-20 mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-dark/0 via-brand-dark/50 to-brand-dark" />
        
        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-4xl md:text-6xl font-heading mb-6"
          >
            Legal & Policies
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-gray-400 max-w-xl mx-auto font-sans text-xl"
          >
            Transparency and trust are at the heart of our journeys. Please review our policies carefully.
          </motion.p>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="sticky top-20 z-40 bg-[#FDFBF7]/90 backdrop-blur-md border-b border-gray-200 shadow-sm transition-all duration-300">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex justify-center gap-8 md:gap-16">
            {[
              { id: "terms", label: "Terms & Conditions", icon: FileText },
              { id: "billing", label: "Billing Policy", icon: CreditCard }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group relative py-6 flex items-center gap-3 transition-colors duration-300 ${
                  activeTab === tab.id ? "text-citius-blue" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <tab.icon className={`w-5 h-5 transition-transform duration-300 ${activeTab === tab.id ? "scale-110" : "group-hover:scale-110"}`} />
                <span className="font-semibold tracking-wide text-sm md:text-base uppercase">{tab.label}</span>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-citius-orange"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="font-sans text-lg">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.5 }}
          >
            {activeTab === "billing" ? (
              <div className="space-y-8">
                <div className="border-b border-gray-200 pb-8 mb-8">
                  <h2 className="text-3xl font-heading text-brand-dark mb-2">
                    {billingPolicy.title}
                  </h2>
                  <p className="text-sm text-gray-500 font-sans tracking-widest uppercase">
                    Last Updated: {billingPolicy.lastUpdated}
                  </p>
                </div>
                {billingPolicy.content.map((section) => (
                  <Section key={section.heading} data={section} />
                ))}
              </div>
            ) : (
              <div className="space-y-8">
                 <div className="border-b border-gray-200 pb-8 mb-8">
                  <h2 className="text-3xl font-heading text-brand-dark mb-2">
                    {termsPolicy.title}
                  </h2>
                   <p className="text-sm text-gray-500 font-sans tracking-widest uppercase mb-6">
                    Last Updated: {termsPolicy.lastUpdated}
                  </p>
                  <p className="text-gray-600 italic">
                    {termsPolicy.intro}
                  </p>
                </div>
                {termsPolicy.content.map((section, idx) => (
                  <Section key={section.heading} data={section} />
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </main>

      {/* Footer CTA */}
      <section className="bg-brand-dark py-16 px-6 mt-12">
        <div className="max-w-4xl mx-auto text-center">
          <Shield className="w-12 h-12 text-citius-orange mx-auto mb-6" />
          <h2 className="text-2xl md:text-3xl font-heading text-white mb-4">
            Have questions about our policies?
          </h2>
          <p className="text-gray-400 mb-8 max-w-lg mx-auto">
            Our support team is here to help you understand our terms and ensure a smooth journey.
          </p>
          <a
            href="/contact"
            className="inline-flex items-center gap-2 bg-citius-orange text-white px-8 py-3 rounded-full hover:bg-white hover:text-citius-orange transition-all duration-300 font-semibold"
          >
            Contact Support
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>
    </div>
  );
}
