"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { Ticker } from "motion-plus/react";
import Acer from "@/static/clients/acer.webp";
import Adani from "@/static/clients/adani.webp";
import Aditya from "@/static/clients/aditya.webp";
import Allegis from "@/static/clients/allegis.webp";
import Ambuja from "@/static/clients/ambuja.webp";
import Berger from "@/static/clients/berger.webp";
import CooperVision from "@/static/clients/coopervision.webp";
import GEHealthcare from "@/static/clients/gehealthcare.webp";
import Godrej from "@/static/clients/godrej.webp";
import Gunnebo from "@/static/clients/gunnebo.webp";
import HDFCBank from "@/static/clients/hdfc.webp";
import Hiranandani from "@/static/clients/hiranandani.webp";
import Iffco from "@/static/clients/iffco.webp";
import Linen from "@/static/clients/linenclub.webp";
import Manking from "@/static/clients/manking.webp";
import Merck from "@/static/clients/merck.webp";
import Philips from "@/static/clients/philips.webp";
import SBIGeneral from "@/static/clients/sbigeneral.webp";
import Sequent from "@/static/clients/sequent.webp";
import Signify from "@/static/clients/signify.webp";
import Tineta from "@/static/clients/tineta.webp";
import Titan from "@/static/clients/titan.webp";
import Volvo from "@/static/clients/volvo.webp";
import Wockhardt from "@/static/clients/wockhardt.webp";
import YesBank from "@/static/clients/yesbank.webp";
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
  { src: Allegis, alt: "Allegis" },
  { src: Ambuja, alt: "Ambuja" },
  { src: Berger, alt: "Berger" },
  { src: CooperVision, alt: "Cooper Vision" },
  { src: GEHealthcare, alt: "GE Healthcare" },
  { src: Godrej, alt: "Godrej" },
  { src: Gunnebo, alt: "Gunnebo" },
  { src: HDFCBank, alt: "HDFC Bank" },
  { src: Hiranandani, alt: "Hiranandani" },
  { src: Iffco, alt: "Iffco" },
  { src: Linen, alt: "Linen Club" },
  { src: Manking, alt: "Manking" },
  { src: Merck, alt: "Merck" },
  { src: Philips, alt: "Philips" },
  { src: SBIGeneral, alt: "SBI General" },
  { src: Sequent, alt: "Sequent" },
  { src: Signify, alt: "Signify" },
  { src: Tineta, alt: "Tineta" },
  { src: Titan, alt: "Titan" },
  { src: Volvo, alt: "Volvo" },
  { src: Wockhardt, alt: "Wockhardt" },
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
      className={cn("py-12 bg-brand-light", className)}
    >
      <h2 className="mb-8 text-2xl font-semibold text-center text-citius-blue">
        Trusted by Industry Leaders
      </h2>
      <Ticker
        velocity={65}
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
