import Link from "next/link";
import { connection } from "next/server";
import { cache } from "react";
import SacredBharatEdition from "@/components/sacredBharat/edition/SacredBharatEdition";
import { resolveOperationalControl } from "@/lib/operationalControls/runtimeService";

// Edition availability is an operational control resolved for each request.
export const instant = false;

const EDITION_METADATA = {
  description: "Five sacred places. One visual detail each. How many do you recognise?",
  openGraph: {
    description: "Five sacred places. One visual detail each. How many do you recognise?",
    images: [
      {
        alt: "Sacred Bharat — Sacred Details",
        height: 1800,
        url: "/images/sacred-bharat/001/amritsar.webp",
        width: 1440,
      },
    ],
    title: "Sacred Bharat — Sacred Details",
  },
  title: "Sacred Bharat — Sacred Details",
  twitter: {
    card: "summary_large_image",
    description: "Five sacred places. One visual detail each. How many do you recognise?",
    images: ["/images/sacred-bharat/001/amritsar.webp"],
    title: "Sacred Bharat — Sacred Details",
  },
};

const WITHDRAWN_METADATA = {
  description: "This Sacred Bharat edition is temporarily unavailable while it is reviewed.",
  openGraph: {
    description: "This Sacred Bharat edition is temporarily unavailable while it is reviewed.",
    title: "Sacred Bharat — Edition under review",
  },
  robots: { follow: true, index: false },
  title: "Sacred Bharat — Edition under review",
  twitter: {
    card: "summary",
    description: "This Sacred Bharat edition is temporarily unavailable while it is reviewed.",
    title: "Sacred Bharat — Edition under review",
  },
};

const getEditionAvailability = cache(async () => {
  await connection();
  try {
    return await resolveOperationalControl("public.sacred_bharat_001");
  } catch {
    return {
      blockedBy: [],
      enabled: false,
      key: "public.sacred_bharat_001",
      reason: "control_service_unavailable",
    };
  }
});

export async function generateMetadata() {
  const availability = await getEditionAvailability();
  return availability.enabled ? EDITION_METADATA : WITHDRAWN_METADATA;
}

function EditionUnderReview() {
  return (
    <main className="relative flex min-h-[100svh] items-center overflow-hidden bg-public-night px-5 py-16 text-white">
      <div className="relative z-10 mx-auto w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.06] p-7 shadow-[0_28px_100px_rgb(0_0_0_/_0.3)] sm:p-10">
        <h1 className="font-heading text-4xl text-public-paper leading-tight sm:text-5xl">
          This edition is under review.
        </h1>
        <p className="mt-4 text-base text-white/70 leading-7">
          Sacred Bharat is temporarily unavailable while its content is reviewed or updated. No quiz
          or sharing data is being collected from this page.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-12 items-center rounded-full bg-public-orange px-5 font-semibold text-public-ink text-sm hover:bg-public-lime focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-2"
            href="/pilgrimage"
          >
            Explore pilgrimage routes
          </Link>
          <Link
            className="inline-flex min-h-12 items-center rounded-full border border-white/20 px-5 font-semibold text-sm text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            href="/"
          >
            Return to Citius Holidays
          </Link>
        </div>
      </div>
    </main>
  );
}

export default async function SacredBharatPage() {
  const availability = await getEditionAvailability();
  return availability.enabled ? <SacredBharatEdition /> : <EditionUnderReview />;
}
