"use client";

import { BriefcaseBusiness, CalendarRange, MapPinned, UsersRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import AnimatedSection from "@/components/layout/AnimatedSection";
import GalleryGridSmall from "@/components/ui/GalleryGridSmall";
import PublicContactCta from "@/components/ui/PublicContactCta";
import PublicGrain from "@/components/ui/PublicGrain";
import PublicTaglineReveal from "@/components/ui/PublicTaglineReveal";
import { MICE_PROPOSAL_CONTACT_HREF } from "@/lib/public/contactIntent";
import WorldMap from "@/static/worldmap.webp";

const MICE_TAGLINE_LINES = ["The room should feel considered.", "The logistics should disappear."];

const commitments = [
  {
    detail: "One person stays with the brief from first conversation through delivery.",
    title: "A designated account manager",
  },
  {
    detail: "The same operating standard across years of programmes, not a new team every time.",
    title: "Continuity for returning teams",
  },
  {
    detail: "We flag cost choices before the proposal hardens, not after the invoice.",
    title: "Cost guidance early",
  },
  {
    detail: "Venue, travel, and guest movement stay coordinated while the event is live.",
    title: "Support on the ground around the clock",
  },
];

const capabilities = [
  {
    className: "lg:col-span-7",
    description: "Focused agendas, venue coordination, and considered delegate movement.",
    Icon: UsersRound,
    title: "Meetings",
  },
  {
    className: "lg:col-span-5",
    description: "Reward journeys shaped around the people and purpose behind the programme.",
    Icon: MapPinned,
    title: "Incentives",
  },
  {
    className: "lg:col-span-5",
    description: "Speaker, attendee, venue, and travel details brought into one working plan.",
    Icon: CalendarRange,
    title: "Conferences",
  },
  {
    className: "lg:col-span-7",
    description: "Coordination that keeps exhibitors, guests, and schedules moving.",
    Icon: BriefcaseBusiness,
    title: "Exhibitions",
  },
];

const operatingModel = [
  {
    description: "Tell us the audience, destination window, goals, and must haves.",
    label: "01",
    title: "Brief",
  },
  {
    description: "We shape the programme, operating details, and proposal for your review.",
    label: "02",
    title: "Plan",
  },
  {
    description: "One accountable team coordinates the journey through delivery on the ground.",
    label: "03",
    title: "Deliver",
  },
];

const fallbackGalleryImages = [
  {
    _key: "approved-mice-event",
    alt: "Conference stage and seated audience",
    asset: { url: "/gallery/mice.webp" },
  },
];

export default function MicePageClient({ images = [] }) {
  const galleryImages = images.length > 0 ? images : fallbackGalleryImages;

  return (
    <>
      <section
        className="relative flex min-h-[44rem] items-end overflow-hidden bg-public-night pt-28 text-white md:min-h-[52rem]"
        data-mice-stage="1"
      >
        <Image
          alt="Conference stage and seated audience"
          className="object-cover object-center"
          fill
          loading="eager"
          sizes="100vw"
          src="/gallery/mice.webp"
        />
        <div className="absolute inset-0 bg-public-night/70" />
        <PublicGrain />
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 md:pb-24 lg:px-8">
          <h1 className="max-w-[680px] text-balance bg-gradient-to-r from-white to-[#9B9B9B] bg-clip-text font-heading font-semibold text-5xl text-transparent leading-tight sm:text-6xl md:text-7xl">
            Corporate events
            <br />
            planned around your brief
          </h1>
          <p className="mt-6 max-w-[680px] text-pretty text-lg text-white/80 leading-8 md:text-xl">
            Meetings, incentives, conferences, and exhibitions. One accountable team owns the
            programme, travel details, and the experience on the ground.
          </p>
          <p className="mt-4 max-w-[680px] text-sm text-white/70">
            Fifteen years of programmes for teams that keep coming back.
          </p>
          <PublicContactCta className="mt-8" href={MICE_PROPOSAL_CONTACT_HREF} tone="glass">
            Request a Proposal
          </PublicContactCta>
        </div>
      </section>

      <AnimatedSection className="bg-public-paper px-4 py-24 sm:px-6 lg:px-8" data-mice-stage="2">
        <div className="mx-auto grid max-w-7xl items-stretch gap-16 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <PublicTaglineReveal lines={MICE_TAGLINE_LINES} />
            <h2 className="mt-16 max-w-[680px] text-balance font-heading font-semibold text-4xl text-public-ink leading-tight md:text-5xl">
              Start with the outcome, not a package
            </h2>
            <p className="mt-6 max-w-[680px] text-pretty text-public-muted leading-7">
              For fifteen years Citius has delivered meetings, incentives, conferences, and
              exhibitions through a team shaped by travel exposure, training, and guest engagement.
            </p>
            <ul className="mt-10 grid gap-6">
              {commitments.map((commitment) => (
                <li className="max-w-[42ch]" key={commitment.title}>
                  <p className="font-heading font-semibold text-public-ink">{commitment.title}</p>
                  <p className="mt-2 text-pretty text-public-muted text-sm leading-6">
                    {commitment.detail}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div className="public-media-edge relative min-h-[30rem] overflow-hidden lg:col-span-7 lg:min-h-[42rem]">
            <Image
              alt="Conference audience facing an illuminated stage"
              className="object-cover object-[58%_center]"
              fill
              sizes="(max-width: 1023px) 100vw, 58vw"
              src="/gallery/mice.webp"
            />
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="bg-public-surface px-4 py-24 sm:px-6 lg:px-8" data-mice-stage="3">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:items-end">
            <h2 className="max-w-[680px] text-balance font-heading font-semibold text-4xl text-public-ink md:text-5xl">
              Four formats. One operating standard.
            </h2>
            <p className="max-w-xl text-pretty text-lg text-public-muted leading-8 md:justify-self-end">
              Every programme has a different audience and purpose. The working plan should reflect
              both, without losing the travel and event details that make it run.
            </p>
          </div>
          <div className="mt-14 grid gap-5 lg:grid-cols-12">
            {capabilities.map(({ className, description, Icon, title }) => (
              <article
                className={`rounded-[2rem] border border-brand-border bg-public-paper p-7 sm:p-9 ${className}`}
                key={title}
              >
                <Icon aria-hidden="true" className="size-8 text-public-blue" strokeWidth={1.6} />
                <h3 className="mt-16 font-heading font-semibold text-3xl text-public-ink">
                  {title}
                </h3>
                <p className="mt-3 max-w-[42ch] text-pretty text-public-muted leading-7">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection
        className="relative overflow-hidden bg-public-night px-4 py-24 text-white sm:px-6 lg:px-8 lg:py-32"
        data-mice-stage="4"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[url('/gallery/bgmice.webp')] bg-center bg-cover opacity-[0.035]"
        />
        <div className="relative mx-auto grid max-w-7xl gap-14 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <p className="text-public-lime text-sm uppercase tracking-[0.2em]">
              The operating model
            </p>
            <h2 className="mt-4 font-heading font-semibold text-4xl leading-tight md:text-5xl">
              From first brief to on-ground delivery.
            </h2>
            <div className="mt-10 space-y-8">
              {operatingModel.map((step) => (
                <article className="grid grid-cols-[2.5rem_1fr] gap-4" key={step.title}>
                  <span className="font-heading text-public-lime/70 text-sm">{step.label}</span>
                  <div>
                    <h3 className="font-heading font-semibold text-2xl">{step.title}</h3>
                    <p className="mt-2 text-white/65 leading-7">{step.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 sm:p-8 lg:col-span-7">
            <p className="mb-5 text-center text-sm text-white/60 uppercase tracking-[0.18em]">
              Programmes coordinated across the globe
            </p>
            <Image
              alt="World map illustrating global MICE programme reach"
              className="h-auto w-full opacity-90"
              height={400}
              src={WorldMap}
              width={800}
            />
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection
        className="bg-public-paper px-4 py-24 sm:px-6 lg:px-8 lg:py-32"
        data-mice-stage="5"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-public-orange-ink text-sm uppercase tracking-[0.2em]">
                The evidence
              </p>
              <h2 className="mt-4 font-heading font-semibold text-4xl text-public-ink md:text-5xl">
                A glimpse into our events.
              </h2>
            </div>
            <p className="max-w-lg text-public-muted leading-7">
              A selection of real event moments from the approved Citius gallery.
            </p>
          </div>
          <GalleryGridSmall className="mt-12" images={galleryImages} />
          <Link
            className="mt-10 inline-flex min-h-11 items-center rounded-full bg-public-orange-ink px-6 py-3 font-semibold text-public-surface transition-[background-color,box-shadow] duration-200 hover:bg-public-blue hover:shadow-lg focus-visible:outline-2 focus-visible:outline-public-orange-ink focus-visible:outline-offset-4"
            href="/gallery"
          >
            View More
          </Link>
        </div>
      </AnimatedSection>

      <AnimatedSection
        className="relative overflow-hidden bg-public-blue px-4 py-24 text-center text-white sm:px-6 lg:px-8 lg:py-32"
        data-mice-stage="6"
      >
        <PublicGrain />
        <div className="relative z-10 mx-auto max-w-3xl">
          <p className="text-public-lime text-sm uppercase tracking-[0.2em]">The next step</p>
          <h2 className="mt-5 font-heading font-semibold text-4xl leading-tight md:text-6xl">
            Bring us the brief. We&apos;ll shape the proposal.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/75 leading-8">
            Share an editable enquiry with the Sales team. Every request is reviewed before the next
            step.
          </p>
          <PublicContactCta className="mx-auto mt-9" href={MICE_PROPOSAL_CONTACT_HREF}>
            Request a Proposal
          </PublicContactCta>
        </div>
      </AnimatedSection>
    </>
  );
}
