"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Map, Heart, Shield, Users, CheckCircle, 
  AlertCircle, Mountain, Coffee, FileText, 
  MapPin, Star
} from "lucide-react";
import Link from "next/link";
import SectionHeading from "../ui/SectionHeading";
import { cn } from "../../utils/cn";

const TabButton = ({ active, onClick, label, icon: Icon }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all rounded-full border",
      active 
        ? "bg-citius-blue text-white border-citius-blue shadow-md" 
        : "bg-white text-brand-muted border-gray-200 hover:border-citius-blue/50 hover:text-citius-blue"
    )}
  >
    {Icon && <Icon className="w-4 h-4" />}
    {label}
  </button>
);

export default function TrailSection({ trail, className }) {
  const [activeTab, setActiveTab] = useState("overview");
  
  if (!trail) return null;

  const { title, subtitle, overview, itinerary, details, info } = trail;

  return (
    <section className={cn("py-20 bg-brand-light/20", className)}>
      <div className="container mx-auto px-4">
        <SectionHeading 
          title={title} 
          subtitle={subtitle}
        />

        {/* Tabs Navigation */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")} label="Overview" icon={Star} />
          <TabButton active={activeTab === "itinerary"} onClick={() => setActiveTab("itinerary")} label="Itinerary" icon={Map} />
          <TabButton active={activeTab === "details"} onClick={() => setActiveTab("details")} label="Trip Details" icon={FileText} />
          <TabButton active={activeTab === "info"} onClick={() => setActiveTab("info")} label="Important Info" icon={AlertCircle} />
        </div>

        {/* Tab Content */}
        <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 min-h-[400px]">
          <AnimatePresence mode="wait">
            
            {activeTab === "overview" && overview && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="grid md:grid-cols-2 gap-12 items-center">
                  <div>
                    <h3 className="text-2xl font-bold text-citius-blue mb-4">{overview.title}</h3>
                    <div className="space-y-4 text-brand-muted">
                      {overview.intro.map((paragraph, idx) => (
                        <p key={idx}>{paragraph}</p>
                      ))}
                      {overview.quote && (
                        <blockquote className="border-l-4 border-citius-orange pl-4 italic my-6">
                          “{overview.quote}”
                        </blockquote>
                      )}
                    </div>
                  </div>
                  <div className="bg-brand-light rounded-xl p-8">
                    <h4 className="font-semibold text-citius-blue mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-citius-orange" /> The Citius Promise
                    </h4>
                    <ul className="space-y-3">
                      {overview.promise.map((item, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-brand-muted">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-1 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    {overview.closing && (
                      <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                        <p className="text-citius-blue font-medium whitespace-pre-line">{overview.closing}</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "itinerary" && itinerary && (
              <motion.div
                key="itinerary"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <h3 className="text-2xl font-bold text-citius-blue mb-8 text-center">{itinerary.length}-Day Spiritual Journey</h3>
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-300 before:to-transparent">
                  {itinerary.map((item, idx) => (
                    <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 group-[.is-active]:bg-citius-orange group-[.is-active]:text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 text-xs font-bold z-10">
                        {idx + 1}
                      </div>
                      
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-bold text-citius-blue">{item.title}</h4>
                          <span className="text-xs font-medium text-citius-orange bg-citius-orange/10 px-2 py-1 rounded">{item.day}</span>
                        </div>
                        <p className="text-sm text-brand-muted">{item.desc}</p>
                      </div>
                      
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === "details" && details && (
              <motion.div
                key="details"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid md:grid-cols-2 gap-8"
              >
                {/* Inclusions */}
                <div className="bg-green-50/50 p-6 rounded-xl border border-green-100">
                  <h4 className="font-bold text-green-800 mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" /> Inclusions
                  </h4>
                  <ul className="space-y-3">
                    {details.inclusions.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Exclusions */}
                <div className="bg-red-50/50 p-6 rounded-xl border border-red-100">
                  <h4 className="font-bold text-red-800 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" /> Not Included
                  </h4>
                  <ul className="space-y-3">
                    {details.exclusions.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Accommodation */}
                <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100 md:col-span-2">
                  <h4 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
                    <Mountain className="w-5 h-5" /> Accommodation
                  </h4>
                  <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {details.accommodation.map((item, i) => (
                      <div key={i} className="bg-white/60 p-3 rounded-lg">
                        <p className="text-xs font-bold text-blue-600 uppercase mb-1">{item.type}</p>
                        <p className="text-sm text-gray-700">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "info" && info && (
              <motion.div
                key="info"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                 <div className="grid md:grid-cols-2 gap-8">
                    <div>
                      <h4 className="font-bold text-citius-blue mb-4 flex items-center gap-2">
                        <Heart className="w-5 h-5 text-citius-orange" /> Eligibility & Health
                      </h4>
                      <ul className="space-y-2 mb-6">
                        {info.eligibility.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-brand-muted">
                            <div className="w-1 h-1 bg-citius-orange rounded-full mt-2 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>

                      <h4 className="font-bold text-citius-blue mb-4 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-citius-orange" /> Medical Support
                      </h4>
                      <p className="text-sm text-brand-muted mb-4">{info.medical}</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-citius-blue mb-4 flex items-center gap-2">
                        <Coffee className="w-5 h-5 text-citius-orange" /> Food & Essentials
                      </h4>
                      <p className="text-sm text-brand-muted mb-4">
                        {info.food}
                      </p>
                      
                       <h4 className="font-bold text-citius-blue mb-4 flex items-center gap-2 mt-6">
                        <MapPin className="w-5 h-5 text-citius-orange" /> Visa & Connectivity
                      </h4>
                      <p className="text-sm text-brand-muted">
                        <strong>Visa:</strong> {info.visa.title.replace('Visa: ', '')}<br/>
                        <strong>Connectivity:</strong> {info.visa.connectivity.replace('Connectivity: ', '')}
                      </p>
                    </div>
                 </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
        
        {/* Pricing & CTA */}
        <div className="mt-12 text-center max-w-2xl mx-auto">
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-citius-orange/20">
             <h3 className="text-xl font-bold text-citius-blue mb-2">Ready for Transformation?</h3>
             <p className="text-brand-muted mb-6">
               Multiple departure batches available. Contact us for the latest pricing for Indian Nationals and NRI/OCI.
             </p>
             <Link href="/contact">
              <button className="px-8 py-4 bg-citius-orange text-white font-bold rounded-full shadow-lg hover:brightness-110 transition-all transform hover:-translate-y-1">
                Request Detailed Brochure & Pricing
              </button>
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
}








