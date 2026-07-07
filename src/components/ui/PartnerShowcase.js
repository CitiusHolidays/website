"use client";

import { m } from "motion/react";
import Image from "next/image";
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
import LogoTicker from "./LogoTicker";

const partners = [
  { alt: "Abu Dhabi", src: AbuDhabi },
  { alt: "Accor", src: Accor },
  { alt: "Air India", src: AirIndia },
  { alt: "Ana Airlines", src: AnaAirlines },
  { alt: "Bali", src: Bali },
  { alt: "British Airways", src: BritishAirways },
  { alt: "Cathay", src: Cathay },
  { alt: "Delta", src: Delta },
  { alt: "Dubai", src: Dubai },
  { alt: "Emirates", src: Emirates },
  { alt: "Ethopian Airlines", src: EthopianAirlines },
  { alt: "Etihad", src: Etihad },
  { alt: "Hilton", src: Hilton },
  { alt: "Hong Kong", src: HongKong },
  { alt: "Hungary", src: Hungary },
  { alt: "Hyatt", src: Hyatt },
  { alt: "IATA", src: Iata },
  { alt: "Incredible India", src: IncredibleIndia },
  { alt: "Indigo", src: Indigo },
  { alt: "ITC Hotel", src: ItcHotel },
  { alt: "Japan", src: Japan },
  { alt: "Japan Airlines", src: JapanAirlines },
  { alt: "Kenya", src: Kenya },
  { alt: "Kenya Airlines", src: KenyaAirlines },
  { alt: "Lufthansa", src: Lufthansa },
  { alt: "Malaysia", src: Malaysia },
  { alt: "Malaysian Airlines", src: MalaysianAirlines },
  { alt: "Malta", src: Malta },
  { alt: "Marriot", src: Marriot },
  { alt: "Mauritius", src: Mauritius },
  { alt: "Oberoi", src: Oberoi },
  { alt: "Polish Airlines", src: PolishAirlines },
  { alt: "Qatar", src: Qatar },
  { alt: "Radisson", src: Radisson },
  { alt: "Safilo", src: Safilo },
  { alt: "Seychelles", src: Seychelles },
  { alt: "Singapore", src: Singapore },
  { alt: "Singapore Airlines", src: SingaporeAirlines },
  { alt: "South Africa", src: SouthAfrica },
  { alt: "Sri Lanka", src: SriLanka },
  { alt: "Sri Lankan Airlines", src: SriLankanAirlines },
  { alt: "Switzerland", src: Switzerland },
  { alt: "Taj Hotel", src: TajHotel },
  { alt: "Thai Airways", src: ThaiAirways },
  { alt: "Thailand", src: Thailand },
  { alt: "USA Tourism", src: USATourism },
  { alt: "VietJet", src: VietJet },
  { alt: "Vietnam", src: Vietnam },
  { alt: "Vietnam Airlines", src: VietnamAirlines },
];

function PartnerBox({ src, alt }) {
  return (
    <m.div
      className="relative flex items-center justify-center overflow-hidden"
      initial="hideInfo"
      style={{ height: 100, width: 180 }}
      whileHover="showInfo"
    >
      <m.div
        className="flex size-full items-center justify-center"
        variants={{
          hideInfo: { filter: "blur(0px)", opacity: 1, scale: 1 },
          showInfo: { filter: "blur(5px)", opacity: 0.3, scale: 0.9 },
        }}
      >
        <Image
          alt={alt}
          height={60}
          src={src}
          style={{ height: "100%", objectFit: "contain", width: "100%" }}
          width={120}
        />
      </m.div>
      <m.div
        className="absolute inset-0 flex items-center justify-center bg-white/70 p-2 font-semibold text-[#222] text-[16px] uppercase"
        style={{ textShadow: "1px 1px 0px #fff" }}
        variants={{
          hideInfo: { opacity: 0, scale: 1.2 },
          showInfo: { opacity: 1, scale: 1 },
        }}
      >
        {alt}
      </m.div>
    </m.div>
  );
}

export default function PartnerShowcase({ className }) {
  const items = partners.map((logo) => <PartnerBox alt={logo.alt} key={logo.alt} src={logo.src} />);

  return (
    <m.section
      className={cn("bg-brand-light py-12", className)}
      initial={{ opacity: 0, y: 40 }}
      transition={{ delay: 0.2, duration: 0.8 }}
      viewport={{ amount: 0.2, once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <h2 className="mb-8 text-center font-semibold text-2xl text-brand-dark">
        Our Global Hospitality, Tourism, and Airline Partners
      </h2>
      <LogoTicker
        gap={24}
        items={items}
        style={{
          alignItems: "center",
          display: "flex",
        }}
        velocity={65}
      />
    </m.section>
  );
}
