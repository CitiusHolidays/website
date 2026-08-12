"use client";

import { m } from "motion/react";
import Image from "next/image";
import { cn } from "@/lib/utils";
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

const PARTNER_PREVIEW_COUNT = 12;

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
    <div className="flex h-24 min-w-0 items-center justify-center rounded-xl border border-brand-border/70 bg-white p-4">
      <Image alt={alt} className="size-full object-contain" height={60} src={src} width={120} />
    </div>
  );
}

export default function PartnerShowcase({ className }) {
  const preview = partners.slice(0, PARTNER_PREVIEW_COUNT);
  const remaining = partners.slice(PARTNER_PREVIEW_COUNT);

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
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {preview.map((logo) => (
          <PartnerBox alt={logo.alt} key={logo.alt} src={logo.src} />
        ))}
      </div>
      <details className="group mx-auto mt-6 max-w-6xl px-4">
        <summary className="mx-auto flex min-h-11 w-fit cursor-pointer list-none items-center rounded-full border border-citius-blue px-5 font-semibold text-citius-blue text-sm transition-colors hover:bg-citius-blue hover:text-white focus-visible:outline-2 focus-visible:outline-citius-orange focus-visible:outline-offset-2">
          <span className="group-open:hidden">Show all partners</span>
          <span className="hidden group-open:inline">Show fewer partners</span>
        </summary>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {remaining.map((logo) => (
            <PartnerBox alt={logo.alt} key={logo.alt} src={logo.src} />
          ))}
        </div>
      </details>
    </m.section>
  );
}
