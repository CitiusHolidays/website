"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { Ticker } from "motion-plus/react";
import AbuDhabi from "@/static/partners/abudhabi.png";
import Accor from "@/static/partners/accor.png";
import AirIndia from "@/static/partners/airindia.png";
import AnaAirlines from "@/static/partners/anaairlines.png";
import Bali from "@/static/partners/bali.png";
import BritishAirways from "@/static/partners/britishairways.png";
import Cathay from "@/static/partners/cathay.png";
import Delta from "@/static/partners/delta.png";
import Dubai from "@/static/partners/dubai.png";
import Emirates from "@/static/partners/emirates.png";
import EthopianAirlines from "@/static/partners/ethopianairlines.png";
import Etihad from "@/static/partners/etihad.png";
import Hilton from "@/static/partners/hilton.png";
import HongKong from "@/static/partners/hongkong.png";
import Hungary from "@/static/partners/hungary.png";
import Hyatt from "@/static/partners/hyatt.png";
import Iata from "@/static/partners/iata.png";
import IncredibleIndia from "@/static/partners/incredibleindia.png";
import Indigo from "@/static/partners/indigo.png";
import ItcHotel from "@/static/partners/itchotel.png";
import Japan from "@/static/partners/japan.png";
import JapanAirlines from "@/static/partners/japanairlines.png";
import Kenya from "@/static/partners/kenya.png";
import KenyaAirlines from "@/static/partners/kenyaairways.png";
import Lufthansa from "@/static/partners/lufthansa.png";
import Malaysia from "@/static/partners/malaysia.png";
import MalaysianAirlines from "@/static/partners/malaysianairlines.png";
import Malta from "@/static/partners/malta.png";
import Marriot from "@/static/partners/marriot.png";
import Mauritius from "@/static/partners/mauritius.png";
import Oberoi from "@/static/partners/oberoi.png";
import PolishAirlines from "@/static/partners/polishairlines.png";
import Qatar from "@/static/partners/qatar.png";
import Radisson from "@/static/partners/radisson.png";
import Safilo from "@/static/partners/safilo.png";
import Seychelles from "@/static/partners/seychelles.png";
import Singapore from "@/static/partners/singapore.png";
import SingaporeAirlines from "@/static/partners/singaporeairlines.png";
import SouthAfrica from "@/static/partners/southafrica.png";
import SriLanka from "@/static/partners/srilanka.png";
import SriLankanAirlines from "@/static/partners/srilankanairlines.png";
import Switzerland from "@/static/partners/switzerland.png";
import TajHotel from "@/static/partners/tajhotel.png";
import ThaiAirways from "@/static/partners/thaiairways.png";
import Thailand from "@/static/partners/thailand.png";
import USATourism from "@/static/partners/USA.png";
import VietJet from "@/static/partners/vietjet.png";
import Vietnam from "@/static/partners/vietnam.png";
import VietnamAirlines from "@/static/partners/vietnamairlines.png";
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
