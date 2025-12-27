"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { Ticker } from "motion-plus/react";
import AbuDhabi from "@/static/partners/abudhabi.webp";
import Accor from "@/static/partners/accor.webp";
import AirIndia from "@/static/partners/airindia.webp";
import AnaAirlines from "@/static/partners/anaairlines.webp";
import Bali from "@/static/partners/bali.webp";
import BritishAirways from "@/static/partners/britishairways.webp";
import Cathay from "@/static/partners/cathay.webp";
import Delta from "@/static/partners/delta.webp";
import Dubai from "@/static/partners/dubai.webp";
import Emirates from "@/static/partners/emirates.webp";
import EthopianAirlines from "@/static/partners/ethopianairlines.webp";
import Etihad from "@/static/partners/etihad.webp";
import Hilton from "@/static/partners/hilton.webp";
import HongKong from "@/static/partners/hongkong.webp";
import Hungary from "@/static/partners/hungary.webp";
import Hyatt from "@/static/partners/hyatt.webp";
import Iata from "@/static/partners/iata.webp";
import IncredibleIndia from "@/static/partners/incredibleindia.webp";
import Indigo from "@/static/partners/indigo.webp";
import ItcHotel from "@/static/partners/itchotel.webp";
import Japan from "@/static/partners/japan.webp";
import JapanAirlines from "@/static/partners/japanairlines.webp";
import Kenya from "@/static/partners/kenya.webp";
import KenyaAirlines from "@/static/partners/kenyaairways.webp";
import Lufthansa from "@/static/partners/lufthansa.webp";
import Malaysia from "@/static/partners/malaysia.webp";
import MalaysianAirlines from "@/static/partners/malaysianairlines.webp";
import Malta from "@/static/partners/malta.webp";
import Marriot from "@/static/partners/marriot.webp";
import Mauritius from "@/static/partners/mauritius.webp";
import Oberoi from "@/static/partners/oberoi.webp";
import PolishAirlines from "@/static/partners/polishairlines.webp";
import Qatar from "@/static/partners/qatar.webp";
import Radisson from "@/static/partners/radisson.webp";
import Safilo from "@/static/partners/safilo.webp";
import Seychelles from "@/static/partners/seychelles.webp";
import Singapore from "@/static/partners/singapore.webp";
import SingaporeAirlines from "@/static/partners/singaporeairlines.webp";
import SouthAfrica from "@/static/partners/southafrica.webp";
import SriLanka from "@/static/partners/srilanka.webp";
import SriLankanAirlines from "@/static/partners/srilankanairlines.webp";
import Switzerland from "@/static/partners/switzerland.webp";
import TajHotel from "@/static/partners/tajhotel.webp";
import ThaiAirways from "@/static/partners/thaiairways.webp";
import Thailand from "@/static/partners/thailand.webp";
import USATourism from "@/static/partners/USA.webp";
import VietJet from "@/static/partners/vietjet.webp";
import Vietnam from "@/static/partners/vietnam.webp";
import VietnamAirlines from "@/static/partners/vietnamairlines.webp";
import { cn } from "../../utils/cn";

const partners = [
  { src: AbuDhabi, alt: "Abu Dhabi" },
  { src: Accor, alt: "Accor" },
  { src: AirIndia, alt: "Air India" },
  { src: AnaAirlines, alt: "Ana Airlines" },
  { src: Bali, alt: "Bali" },
  { src: BritishAirways, alt: "British Airways" },
  { src: Cathay, alt: "Cathay" },
  { src: Delta, alt: "Delta" },
  { src: Dubai, alt: "Dubai" },
  { src: Emirates, alt: "Emirates" },
  { src: EthopianAirlines, alt: "Ethopian Airlines" },
  { src: Etihad, alt: "Etihad" },
  { src: Hilton, alt: "Hilton" },
  { src: HongKong, alt: "Hong Kong" },
  { src: Hungary, alt: "Hungary" },
  { src: Hyatt, alt: "Hyatt" },
  { src: Iata, alt: "IATA" },
  { src: IncredibleIndia, alt: "Incredible India" },
  { src: Indigo, alt: "Indigo" },
  { src: ItcHotel, alt: "ITC Hotel" },
  { src: Japan, alt: "Japan" },
  { src: JapanAirlines, alt: "Japan Airlines" },
  { src: Kenya, alt: "Kenya" },
  { src: KenyaAirlines, alt: "Kenya Airlines" },
  { src: Lufthansa, alt: "Lufthansa" },
  { src: Malaysia, alt: "Malaysia" },
  { src: MalaysianAirlines, alt: "Malaysian Airlines" },
  { src: Malta, alt: "Malta" },
  { src: Marriot, alt: "Marriot" },
  { src: Mauritius, alt: "Mauritius" },
  { src: Oberoi, alt: "Oberoi" },
  { src: PolishAirlines, alt: "Polish Airlines" },
  { src: Qatar, alt: "Qatar" },
  { src: Radisson, alt: "Radisson" },
  { src: Safilo, alt: "Safilo" },
  { src: Seychelles, alt: "Seychelles" },
  { src: Singapore, alt: "Singapore" },
  { src: SingaporeAirlines, alt: "Singapore Airlines" },
  { src: SouthAfrica, alt: "South Africa" },
  { src: SriLanka, alt: "Sri Lanka" },
  { src: SriLankanAirlines, alt: "Sri Lankan Airlines" },
  { src: Switzerland, alt: "Switzerland" },
  { src: TajHotel, alt: "Taj Hotel" },
  { src: ThaiAirways, alt: "Thai Airways" },
  { src: Thailand, alt: "Thailand" },
  { src: USATourism, alt: "USA Tourism" },
  { src: VietJet, alt: "VietJet" },
  { src: Vietnam, alt: "Vietnam" },
  { src: VietnamAirlines, alt: "Vietnam Airlines" },
];

function PartnerBox({ src, alt }) {
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

export default function PartnerShowcase({ className }) {
  const items = partners.map((logo, idx) => (
    <PartnerBox key={idx} src={logo.src} alt={logo.alt} />
  ));

  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      viewport={{ once: true, amount: 0.2 }}
      className={cn("py-12 bg-brand-light", className)}
    >
      <h2 className="text-center text-2xl font-semibold text-brand-dark mb-8">
        Our Global Hospitality, Tourism, and Airline Partners
      </h2>
      <Ticker
        velocity={65}
        items={items}
        style={{
          display: "flex",
          alignItems: "center",
          maskImage:
            "linear-gradient(to right, transparent 5%, black 10%, black 90%, transparent 95%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 5%, black 10%, black 90%, transparent 95%)",
        }}
        gap={5}
      />
    </motion.section>
  );
}
