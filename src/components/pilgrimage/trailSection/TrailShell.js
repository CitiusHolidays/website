import {
  ArrowRight,
  BookOpen,
  Camera,
  CheckCircle,
  FileText,
  Info,
  Map as MapIcon,
  MessageSquare,
  Quote,
  Sparkles,
  Star,
  Users,
  Video,
} from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { cn } from "@/utils/cn";
import { HighlightsTab, ItineraryTab, TabButton } from "./TrailCoreTabs";
import {
  DeparturesBlock,
  InfoTab,
  PackageDetailsTab,
  RegistrationAndPolicySection,
} from "./TrailDetailsTabs";
import { BlogsTab, BookingTab, GalleryTab, MediaTab, ReviewsTab } from "./TrailMediaTabs";

export function TrailHeader({ trail, title, subtitle, tagline, positioning, isComingSoon }) {
  return (
    <>
      <div className="mb-10 text-center md:mb-16">
        <m.div
          initial={{ opacity: 0, y: 30 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
            {isComingSoon && (
              <span className="inline-block rounded-full border border-amber-200 bg-amber-100 px-3 py-1.5 font-medium text-amber-900 text-xs uppercase tracking-wider">
                Coming soon
              </span>
            )}
            {tagline && (
              <span className="inline-block rounded-full bg-citius-orange/10 px-3 py-1.5 font-medium text-citius-orange text-xs uppercase tracking-wider">
                {tagline}
              </span>
            )}
          </div>
          <h2 className="mb-3 font-heading text-2xl text-citius-blue leading-tight md:mb-4 md:text-4xl lg:text-5xl">
            {title}
          </h2>
          <p className="mx-auto max-w-2xl font-sans text-brand-muted text-lg italic leading-relaxed md:text-xl">
            {subtitle}
          </p>
          {positioning && (
            <p className="mx-auto mt-3 max-w-xl font-sans text-brand-muted/80 text-sm md:text-base">
              {positioning}
            </p>
          )}
          <div className="mx-auto mt-6 h-1 w-12 rounded-full bg-citius-orange md:mt-8 md:w-16" />
        </m.div>
      </div>

      {trail.quickFacts && (
        <m.div
          className="mb-10 flex flex-wrap justify-center gap-3 md:mb-14 md:gap-6"
          initial={{ opacity: 0, y: 20 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          {Object.entries(trail.quickFacts).map(([key, value]) => (
            <div
              className="rounded-xl border border-brand-light bg-white px-4 py-2.5 shadow-sm"
              key={key}
            >
              <span className="block text-[10px] text-brand-muted uppercase tracking-wider md:text-xs">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </span>
              <span className="font-heading font-medium text-citius-blue text-sm md:text-base">
                {value}
              </span>
            </div>
          ))}
        </m.div>
      )}
    </>
  );
}

export function TrailTabs({ activeTab, setActiveTab, flags }) {
  const tabs = [
    { icon: Star, id: "overview", label: "Overview", show: true },
    { icon: Camera, id: "gallery", label: "Gallery", show: flags.hasGallery },
    { icon: Sparkles, id: "highlights", label: "Highlights", show: flags.hasHighlights },
    { icon: MapIcon, id: "itinerary", label: "Itinerary", show: flags.hasItinerary },
    { icon: FileText, id: "details", label: "Package details", show: flags.hasPackageDetails },
    { icon: Info, id: "info", label: "Important Info", show: flags.hasInfo },
    { icon: MessageSquare, id: "booking", label: "Booking", show: flags.hasBooking },
    { icon: Quote, id: "reviews", label: "Reviews", show: flags.hasReviews },
    { icon: Video, id: "media", label: "Video / AR", show: flags.hasMedia },
    { icon: BookOpen, id: "blogs", label: "Blogs", show: flags.hasBlogs },
  ];

  return (
    <div className="mb-8 flex flex-wrap justify-center gap-2 md:mb-12 md:gap-3">
      {tabs.reduce((items, tab) => {
        if (!tab.show) {
          return items;
        }
        items.push(
          <TabButton
            active={activeTab === tab.id}
            icon={tab.icon}
            key={tab.id}
            label={tab.label}
            onClick={() => setActiveTab(tab.id)}
          />
        );
        return items;
      }, [])}
    </div>
  );
}

function OverviewTab({ overview, trail }) {
  if (!overview) {
    return null;
  }

  return (
    <m.div
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6 md:space-y-8"
      exit={{ opacity: 0, x: 20 }}
      initial={{ opacity: 0, x: -20 }}
      key="overview"
    >
      <div
        className={cn(
          "grid items-start gap-6 md:gap-12",
          overview.promise?.length ? "lg:grid-cols-5" : "lg:grid-cols-1"
        )}
      >
        <div className={overview.promise?.length ? "lg:col-span-3" : ""}>
          <h3 className="mb-4 font-heading text-citius-blue text-xl md:mb-6 md:text-2xl">
            {overview.title}
          </h3>
          <div className="space-y-3 font-sans text-base text-brand-muted leading-relaxed md:space-y-4 md:text-lg">
            {(overview.intro || []).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {overview.privateGroupNote && (
              <div className="my-4 rounded-2xl border border-citius-blue/15 bg-citius-blue/5 p-5 md:my-6 md:p-6">
                <p className="text-brand-dark text-sm leading-relaxed md:text-base">
                  {overview.privateGroupNote}
                </p>
              </div>
            )}
            {overview.quote && (
              <blockquote className="relative my-6 border-citius-orange border-l-2 bg-brand-light/30 p-4 text-lg italic md:my-8 md:p-6 md:text-xl">
                <span className="absolute -top-3 -left-1 font-serif text-4xl text-citius-orange/20 md:text-5xl">
                  &ldquo;
                </span>
                {overview.quote}
              </blockquote>
            )}
          </div>
          <DeparturesBlock departures={trail.departures} />
        </div>

        {overview.promise?.length > 0 && (
          <div className="rounded-2xl bg-brand-dark p-6 text-white shadow-xl md:p-8 lg:col-span-2">
            <h4 className="mb-4 flex items-center gap-2 font-heading text-citius-orange text-lg md:mb-6 md:text-xl">
              <Users className="size-5" />
              The Citius Promise
            </h4>
            <ul className="space-y-3 md:space-y-4">
              {overview.promise.map((item) => (
                <li className="group flex items-start gap-3" key={item}>
                  <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 transition-colors group-hover:bg-citius-orange/20">
                    <CheckCircle className="size-3 text-citius-orange" />
                  </div>
                  <span className="font-sans text-sm text-white/80 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
            {overview.closing && (
              <div className="mt-6 border-white/10 border-t pt-6 text-center md:mt-8">
                <p className="whitespace-pre-line font-sans text-citius-orange text-lg italic md:text-xl">
                  {overview.closing}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <RegistrationAndPolicySection policy={trail.registrationAndPolicy} />
    </m.div>
  );
}

export function TrailTabContent({ activeTab, trail, relatedBlogPosts, flags, reviewsList }) {
  const {
    overview,
    highlights,
    itinerary,
    details,
    info,
    layoutVariant = "trek",
    gallery = [],
    bookingOptions = [],
    media,
  } = trail;

  return (
    <div className="relative min-h-[400px] overflow-hidden rounded-2xl border border-brand-light bg-white p-5 shadow-brand-dark/5 shadow-xl md:rounded-3xl md:p-10 lg:p-14">
      <div className="pointer-events-none absolute top-0 right-0 h-48 w-48 translate-x-1/2 -translate-y-1/2 rounded-full bg-citius-orange/5 blur-3xl md:h-64 md:w-64" />

      <AnimatePresence mode="wait">
        {activeTab === "overview" && <OverviewTab overview={overview} trail={trail} />}
        {activeTab === "highlights" && highlights && <HighlightsTab highlights={highlights} />}
        {activeTab === "itinerary" && itinerary && (
          <ItineraryTab
            itinerary={itinerary}
            itineraryTimelineImage={trail.itineraryTimelineImage}
          />
        )}
        {activeTab === "details" && details && <PackageDetailsTab trail={trail} />}
        {activeTab === "info" && info && <InfoTab info={info} layoutVariant={layoutVariant} />}
        {activeTab === "gallery" && flags.hasGallery && <GalleryTab gallery={gallery} />}
        {activeTab === "booking" && flags.hasBooking && <BookingTab options={bookingOptions} />}
        {activeTab === "reviews" && flags.hasReviews && <ReviewsTab testimonials={reviewsList} />}
        {activeTab === "media" && flags.hasMedia && <MediaTab media={media} />}
        {activeTab === "blogs" && flags.hasBlogs && <BlogsTab posts={relatedBlogPosts} />}
      </AnimatePresence>
    </div>
  );
}

export function TrailCta({ isAerial }) {
  return (
    <m.div
      className="mt-12 text-center md:mt-16"
      initial={{ opacity: 0, y: 30 }}
      viewport={{ once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <div className="group relative overflow-hidden rounded-2xl bg-linear-to-br from-brand-dark to-citius-blue p-6 shadow-2xl md:rounded-3xl md:p-10">
        <div className="absolute -top-20 -right-20 size-40 rounded-full bg-citius-orange/10 blur-2xl transition-transform duration-1000 fine-hover:group-hover:scale-150" />
        <div className="absolute -bottom-20 -left-20 size-40 rounded-full bg-citius-blue/20 blur-2xl transition-transform duration-1000 fine-hover:group-hover:scale-150" />

        <div className="relative z-10">
          <h3 className="mb-3 font-heading text-2xl text-white italic md:text-3xl">
            Ready for <span className="text-citius-orange">Transformation?</span>
          </h3>
          <p className="mx-auto mb-6 max-w-xl font-sans text-base text-white/60 md:text-lg">
            {isAerial
              ? "Limited seats per charter. Book early for preferred dates."
              : "Multiple departure batches June–September 2026. Early registration recommended."}
          </p>
          <Link
            className="inline-flex items-center gap-2 rounded-full bg-citius-orange px-8 py-3.5 font-heading text-brand-dark text-sm tracking-wider shadow-citius-orange/20 shadow-xl transition-[translate,box-shadow,filter] duration-300 fine-hover:hover:-translate-y-0.5 hover:shadow-citius-orange/40 hover:brightness-110 active:translate-y-0 md:px-10 md:py-4"
            href="/contact"
          >
            Request Detailed Brochure
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </m.div>
  );
}
