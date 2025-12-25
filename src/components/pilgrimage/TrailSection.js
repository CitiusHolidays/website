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
      "flex items-center gap-2 px-8 py-3 text-sm font-heading tracking-widest transition-all rounded-full border uppercase",
      active 
        ? "bg-citius-blue text-white border-citius-blue shadow-lg scale-105" 
        : "bg-white text-brand-muted border-gray-200 hover:border-citius-blue/30 hover:text-citius-blue"
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
    <section className={cn("py-32", className)}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-heading text-3xl md:text-5xl text-citius-blue mb-6"
          >
            {title}
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-sans text-xl md:text-2xl text-brand-muted max-w-2xl mx-auto italic"
          >
            {subtitle}
          </motion.p>
          <div className="w-16 h-1 bg-citius-orange mx-auto mt-8 rounded-full" />
        </div>

        {/* Tabs Navigation */}
        <div className="flex flex-wrap justify-center gap-4 mb-16">
          <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")} label="Overview" icon={Star} />
          <TabButton active={activeTab === "itinerary"} onClick={() => setActiveTab("itinerary")} label="Itinerary" icon={Map} />
          <TabButton active={activeTab === "details"} onClick={() => setActiveTab("details")} label="Trip Details" icon={FileText} />
          <TabButton active={activeTab === "info"} onClick={() => setActiveTab("info")} label="Important Info" icon={AlertCircle} />
        </div>

        {/* Tab Content */}
        <div className="max-w-6xl mx-auto bg-white rounded-[2rem] shadow-xl shadow-brand-dark/5 border border-brand-light p-8 md:p-16 min-h-[500px] relative overflow-hidden">
          {/* Subtle decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-citius-orange/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
          
          <AnimatePresence mode="wait">
            
            {activeTab === "overview" && overview && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-12"
              >
                <div className="grid lg:grid-cols-5 gap-16 items-start">
                  <div className="lg:col-span-3">
                    <h3 className="font-heading text-2xl text-citius-blue mb-8">{overview.title}</h3>
                    <div className="space-y-6 font-sans text-2xl text-brand-muted leading-relaxed">
                      {overview.intro.map((paragraph, idx) => (
                        <p key={idx}>{paragraph}</p>
                      ))}
                      {overview.quote && (
                        <blockquote className="relative p-8 border-l-2 border-citius-orange bg-brand-light/30 italic my-10 text-2xl">
                          <span className="absolute -top-4 -left-2 text-6xl text-citius-orange/20 font-serif">“</span>
                          {overview.quote}
                        </blockquote>
                      )}
                    </div>
                  </div>
                  <div className="lg:col-span-2 bg-brand-dark rounded-2xl p-10 text-white shadow-2xl">
                    <h4 className="font-heading text-xl text-citius-orange mb-8 flex items-center gap-3">
                      <Users className="w-6 h-6" /> The Citius Promise
                    </h4>
                    <ul className="space-y-6">
                      {overview.promise.map((item, i) => (
                        <li key={i} className="flex items-start gap-4 group">
                          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-1 group-hover:bg-citius-orange/20 transition-colors">
                            <CheckCircle className="w-4 h-4 text-citius-orange" />
                          </div>
                          <span className="font-sans text-sm text-white/80 leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                    {overview.closing && (
                      <div className="mt-10 pt-10 border-t border-white/10 text-center">
                        <p className="font-sans text-xl italic text-citius-orange whitespace-pre-line">{overview.closing}</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "itinerary" && itinerary && (
              <motion.div
                key="itinerary"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
              >
                <h3 className="font-heading text-3xl text-citius-blue mb-12 text-center">{itinerary.length}-Day Spiritual Journey</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {itinerary.map((item, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group bg-brand-light/40 p-8 rounded-2xl border border-transparent hover:border-citius-orange/20 hover:bg-white hover:shadow-xl transition-all"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className="font-heading text-xs font-bold text-citius-orange tracking-widest uppercase">{item.day}</span>
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-bold text-citius-blue shadow-sm">
                          {idx + 1}
                        </div>
                      </div>
                      <h4 className="font-heading text-lg text-citius-blue mb-4 leading-tight group-hover:text-citius-orange transition-colors">{item.title}</h4>
                      <p className="font-sans text-sm text-brand-muted leading-relaxed">{item.desc}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === "details" && details && (
              <motion.div
                key="details"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid lg:grid-cols-2 gap-12"
              >
                {/* Inclusions */}
                <div className="bg-green-50/30 p-10 rounded-3xl border border-green-100/50">
                  <h4 className="font-heading text-xl text-green-900 mb-8 flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600" /> Inclusions
                  </h4>
                  <ul className="space-y-5">
                    {details.inclusions.map((item, i) => (
                      <li key={i} className="flex items-start gap-4 font-sans text-sm text-gray-700">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 shrink-0 shadow-sm shadow-green-200" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Exclusions */}
                <div className="bg-red-50/30 p-10 rounded-3xl border border-red-100/50">
                  <h4 className="font-heading text-xl text-red-900 mb-8 flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-red-600" /> Not Included
                  </h4>
                  <ul className="space-y-5">
                    {details.exclusions.map((item, i) => (
                      <li key={i} className="flex items-start gap-4 font-sans text-sm text-gray-700">
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 shrink-0 shadow-sm shadow-red-200" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Accommodation */}
                <div className="lg:col-span-2 bg-brand-light/50 p-10 rounded-3xl border border-brand-light">
                  <h4 className="font-heading text-xl text-citius-blue mb-8 flex items-center gap-3">
                    <Mountain className="w-6 h-6 text-citius-orange" /> Accommodation Excellence
                  </h4>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {details.accommodation.map((item, i) => (
                      <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-brand-light hover:shadow-md transition-shadow">
                        <p className="font-heading text-[10px] font-bold text-citius-orange uppercase tracking-[0.2em] mb-2">{item.type}</p>
                        <p className="font-sans text-sm text-brand-dark font-medium leading-relaxed">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "info" && info && (
              <motion.div
                key="info"
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-12"
              >
                 <div className="grid lg:grid-cols-2 gap-16">
                    <div className="space-y-10">
                      <div>
                        <h4 className="font-heading text-xl text-citius-blue mb-6 flex items-center gap-3">
                          <Heart className="w-6 h-6 text-citius-orange" /> Eligibility & Health
                        </h4>
                        <ul className="grid sm:grid-cols-2 gap-4">
                          {info.eligibility.map((item, i) => (
                            <li key={i} className="flex items-start gap-3 p-4 bg-brand-light/50 rounded-xl font-sans text-xs text-brand-muted">
                              <div className="w-1.5 h-1.5 bg-citius-orange rounded-full mt-1.5 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-heading text-xl text-citius-blue mb-6 flex items-center gap-3">
                          <Shield className="w-6 h-6 text-citius-orange" /> Medical Support
                        </h4>
                        <div className="p-6 bg-blue-50/30 rounded-2xl border border-blue-100/50">
                          <p className="font-sans text-sm text-brand-muted leading-relaxed">{info.medical}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-10">
                      <div>
                        <h4 className="font-heading text-xl text-citius-blue mb-6 flex items-center gap-3">
                          <Coffee className="w-6 h-6 text-citius-orange" /> Food & Essentials
                        </h4>
                        <div className="p-6 bg-orange-50/30 rounded-2xl border border-orange-100/50">
                          <p className="font-sans text-sm text-brand-muted leading-relaxed">
                            {info.food}
                          </p>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-heading text-xl text-citius-blue mb-6 flex items-center gap-3">
                          <MapPin className="w-6 h-6 text-citius-orange" /> Visa & Connectivity
                        </h4>
                        <div className="grid gap-4">
                          <div className="p-6 bg-brand-dark rounded-2xl text-white shadow-xl">
                            <p className="font-heading text-xs text-citius-orange tracking-widest uppercase mb-2">Travel Documents</p>
                            <p className="font-sans text-sm text-white/80">{info.visa.title.replace('Visa: ', '')}</p>
                          </div>
                          <div className="p-6 bg-white rounded-2xl border border-brand-light shadow-sm">
                            <p className="font-heading text-[10px] text-brand-muted tracking-widest uppercase mb-2">Digital Connection</p>
                            <p className="font-sans text-sm text-brand-dark font-medium">{info.visa.connectivity.replace('Connectivity: ', '')}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                 </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
        
        {/* Pricing & CTA */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-20 text-center max-w-3xl mx-auto"
        >
          <div className="bg-brand-dark p-12 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
             {/* Decorative circles */}
             <div className="absolute -top-24 -right-24 w-48 h-48 bg-citius-orange/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000" />
             <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-citius-blue/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000" />
             
             <div className="relative z-10">
               <h3 className="font-heading text-3xl text-white mb-4 italic">Ready for <span className="text-citius-orange">Transformation?</span></h3>
               <p className="font-sans text-2xl text-white/60 mb-10 max-w-xl mx-auto">
                 Multiple departure batches available. Contact us for the latest pricing for Indian Nationals and NRI/OCI travelers.
               </p>
               <Link href="/contact">
                <button className="px-12 py-5 bg-citius-orange text-white font-heading tracking-widest text-sm rounded-full shadow-xl shadow-citius-orange/20 hover:shadow-citius-orange/40 hover:-translate-y-1 hover:brightness-110 active:translate-y-0 transition-all duration-300">
                  Request Detailed Brochure
                </button>
              </Link>
             </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}








