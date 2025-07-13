"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { Ticker } from "motion-plus/react";
import Acer from "@/static/clients/acer.png";
import Adani from "@/static/clients/adani.png";
import Aditya from "@/static/clients/aditya.png";
import CooperVision from "@/static/clients/coopervision.png";
import GEHealthcare from "@/static/clients/gehealthcare.png";
import Godrej from "@/static/clients/godrej.png";
import HDFCBank from "@/static/clients/hdfc.png";
import Merck from "@/static/clients/merck.png";
import Philips from "@/static/clients/philips.png";
import SBIGeneral from "@/static/clients/sbigeneral.png";
import Titan from "@/static/clients/titan.png";
import Volvo from "@/static/clients/volvo.png";
import YesBank from "@/static/clients/yesbank.png";
import { cn } from "../../utils/cn";

function ClientBox({ src, alt }) {
  return (
    <motion.div
      className="relative flex items-center justify-center overflow-hidden"
      style={{ width: 180, height: 100 }}
      initial="hideInfo"
      whileHover="showInfo"
    >
      <motion.div
        className="flex items-center justify-center w-full h-full"
        variants={{
          hideInfo: { scale: 1, filter: "blur(0px)", opacity: 1 },
          showInfo: { scale: 0.9, filter: "blur(5px)", opacity: 0.3 },
        }}
      >
        <Image
          src={src}
          alt={alt}
          width={120}
          height={60}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </motion.div>
      <motion.div
        className="absolute inset-0 flex items-center justify-center px-2 py-2 text-[16px] font-semibold uppercase text-[#222] bg-white/70"
        style={{ textShadow: "1px 1px 0px #fff" }}
        variants={{
          hideInfo: { opacity: 0, scale: 1.2 },
          showInfo: { opacity: 1, scale: 1 },
        }}
      >
        {alt}
      </motion.div>
    </motion.div>
  );
}

const clients = [
  { src: Acer, alt: "Acer" },
  { src: Adani, alt: "Adani" },
  { src: Aditya, alt: "Aditya Birla" },
  { src: CooperVision, alt: "Cooper Vision" },
  { src: GEHealthcare, alt: "GE Healthcare" },
  { src: Godrej, alt: "Godrej" },
  { src: HDFCBank, alt: "HDFC Bank" },
  { src: Merck, alt: "Merck" },
  { src: Philips, alt: "Philips" },
  { src: SBIGeneral, alt: "SBI General" },
  { src: Titan, alt: "Titan" },
  { src: Volvo, alt: "Volvo" },
  { src: YesBank, alt: "Yes Bank" },
];

export default function ClientShowcase({ className }) {
  const items = clients.map((logo, index) => (
    <ClientBox key={index} src={logo.src} alt={logo.alt} />
  ));

  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      viewport={{ once: true, amount: 0.2 }}
      className={cn("py-12 bg-white", className)}
    >
      <h2 className="mb-8 text-2xl font-semibold text-center text-brand-dark">
        Trusted by Industry Leaders
      </h2>
      <Ticker
        duration={40}
        items={items}
        style={{
          display: "flex",
          gap: "3rem",
          alignItems: "center",
          maskImage:
            "linear-gradient(to right, transparent 5%, black 10%, black 90%, transparent 95%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 5%, black 10%, black 90%, transparent 95%)",
        }}
        gap={10}
      />
    </motion.section>
  );
}
