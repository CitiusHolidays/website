"use client";

import { cn } from "@/lib/utils";
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
import LogoMarquee from "./LogoMarquee";
import LogoNameReveal from "./LogoNameReveal";

function ClientBox({ src, alt }) {
  return (
    <div className="flex h-20 min-w-0 items-center justify-center overflow-hidden">
      <LogoNameReveal alt={alt} src={src} />
    </div>
  );
}

const clients = [
  { alt: "Acer", src: Acer },
  { alt: "Adani", src: Adani },
  { alt: "Aditya Birla", src: Aditya },
  { alt: "Allegis", src: Allegis },
  { alt: "Ambuja", src: Ambuja },
  { alt: "Berger", src: Berger },
  { alt: "Cooper Vision", src: CooperVision },
  { alt: "GE Healthcare", src: GEHealthcare },
  { alt: "Godrej", src: Godrej },
  { alt: "Gunnebo", src: Gunnebo },
  { alt: "HDFC Bank", src: HDFCBank },
  { alt: "Hiranandani", src: Hiranandani },
  { alt: "Iffco", src: Iffco },
  { alt: "Linen Club", src: Linen },
  { alt: "Manking", src: Manking },
  { alt: "Merck", src: Merck },
  { alt: "Philips", src: Philips },
  { alt: "SBI General", src: SBIGeneral },
  { alt: "Sequent", src: Sequent },
  { alt: "Signify", src: Signify },
  { alt: "Tineta", src: Tineta },
  { alt: "Titan", src: Titan },
  { alt: "Volvo", src: Volvo },
  { alt: "Wockhardt", src: Wockhardt },
  { alt: "Yes Bank", src: YesBank },
];

export default function ClientShowcase({ className }) {
  const items = clients.slice(6).map((logo) => (
    <div className="w-40" key={logo.alt}>
      <ClientBox alt={logo.alt} src={logo.src} />
    </div>
  ));

  return (
    <section className={cn("bg-brand-light py-8", className)}>
      <h3 className="mb-5 font-heading font-semibold text-public-ink text-xl">Corporate clients</h3>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
        {clients.slice(0, 6).map((logo) => (
          <ClientBox alt={logo.alt} key={logo.alt} src={logo.src} />
        ))}
      </div>
      <details className="mt-4">
        <summary className="min-h-11 cursor-pointer py-3 font-medium text-public-blue focus-visible:outline-2 focus-visible:outline-public-orange-ink focus-visible:outline-offset-4">
          More corporate clients
        </summary>
        <LogoMarquee gap={48} items={items} velocity={65} />
      </details>
    </section>
  );
}
