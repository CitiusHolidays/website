import { Camera, Clock, Coffee, MapPin, Mountain, Sparkles, Users } from "lucide-react";
import { m } from "motion/react";
import Image from "next/image";
import { cn } from "@/utils/cn";

export const TabButton = ({ active, onClick, label, icon: Icon }) => (
  <button
    className={cn(
      "flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2.5 font-heading text-xs uppercase tracking-wider transition-[border-color,background-color,color,box-shadow] md:px-6 md:py-3 md:text-sm",
      active
        ? "scale-105 border-citius-blue bg-citius-blue text-white shadow-lg"
        : "border-gray-200 bg-white text-brand-muted hover:border-citius-blue/30 hover:text-citius-blue"
    )}
    onClick={onClick}
    type="button"
  >
    {Icon && <Icon className="size-3.5 md:h-4 md:w-4" />}
    {label}
  </button>
);

export function HighlightsTab({ highlights }) {
  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
      exit={{ opacity: 0, y: -20 }}
      initial={{ opacity: 0, y: 20 }}
    >
      <h3 className="mb-8 text-center font-heading text-citius-blue text-xl md:text-2xl">
        Sacred Sites Along the Journey
      </h3>

      <div className="grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {highlights.map((site, idx) => (
          <m.div
            animate={{ opacity: 1, scale: 1 }}
            className="group rounded-2xl border border-brand-light bg-linear-to-br from-white to-brand-light/50 p-5 transition-[border-color,box-shadow] duration-300 hover:border-citius-orange/30 hover:shadow-lg md:p-6"
            initial={{ opacity: 0, scale: 0.95 }}
            key={site.title}
            transition={{ delay: idx * 0.1 }}
          >
            <div className="mb-3 flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-citius-orange/10">
                <Sparkles className="size-4 text-citius-orange md:h-5 md:w-5" />
              </div>
              <div>
                <span className="font-medium text-[10px] text-citius-orange uppercase tracking-wider md:text-xs">
                  {site.significance}
                </span>
                <h4 className="font-heading text-base text-citius-blue leading-tight md:text-lg">
                  {site.title}
                </h4>
              </div>
            </div>
            <p className="mb-2 flex items-center gap-1 text-brand-muted text-xs md:text-sm">
              <MapPin className="size-3" />
              {site.location}
            </p>
            <p className="text-brand-dark/80 text-sm leading-relaxed">{site.description}</p>
          </m.div>
        ))}
      </div>
    </m.div>
  );
}

/** Per-day image: use `image.src` or a dashed placeholder (`image.caption` optional). */
function DayItineraryImage({ item, dayLabel }) {
  const image = item.image;
  if (image?.src) {
    const intrinsic =
      typeof image.width === "number" &&
      typeof image.height === "number" &&
      image.width > 0 &&
      image.height > 0;

    if (intrinsic) {
      return (
        <div className="relative w-full overflow-hidden rounded-xl border border-brand-light bg-brand-light/20 shadow-inner">
          <Image
            alt={image.alt || `${dayLabel} — ${item.title || "Itinerary"}`}
            className="h-auto w-full"
            height={image.height}
            sizes="(max-width: 768px) 100vw, 360px"
            src={image.src}
            width={image.width}
          />
        </div>
      );
    }

    return (
      <div className="relative aspect-16/10 w-full overflow-hidden rounded-xl border border-brand-light bg-brand-light/20 shadow-inner">
        <Image
          alt={image.alt || `${dayLabel} — ${item.title || "Itinerary"}`}
          className="object-cover"
          fill
          sizes="(max-width: 768px) 100vw, 360px"
          src={image.src}
          style={image.objectPosition ? { objectPosition: image.objectPosition } : undefined}
        />
      </div>
    );
  }

  const caption = image?.caption || `Add a photo for ${dayLabel}`;

  return (
    <div className="relative flex aspect-16/10 w-full flex-col items-center justify-center rounded-xl border-2 border-citius-orange/25 border-dashed bg-linear-to-br from-brand-light/80 to-brand-light/40 px-3 text-center shadow-inner">
      <Camera aria-hidden className="mb-2 size-8 text-citius-orange/45" />
      <p className="font-heading text-brand-muted text-xs leading-snug">{caption}</p>
    </div>
  );
}

export function ItineraryTab({ itinerary, itineraryTimelineImage }) {
  const hasImage = itineraryTimelineImage?.src;
  const showPlaceholder = itineraryTimelineImage?.placeholder && !hasImage;

  return (
    <m.div
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
      exit={{ opacity: 0, scale: 1.05 }}
      initial={{ opacity: 0, scale: 0.95 }}
    >
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-heading text-citius-blue text-xl md:text-2xl">
          {itinerary.length}-Day Journey
        </h3>
        <span className="rounded-full bg-brand-light px-3 py-1.5 text-brand-muted text-xs md:text-sm">
          Scroll to explore each day
        </span>
      </div>

      {(hasImage || showPlaceholder) && (
        <div className="mb-8 overflow-hidden rounded-2xl border border-brand-light bg-brand-light/30 shadow-inner">
          {hasImage ? (
            <div className="relative aspect-21/9 w-full md:aspect-2.4/1">
              <Image
                alt={itineraryTimelineImage.alt || "Journey visual"}
                className="object-cover"
                fill
                sizes="(max-width: 768px) 100vw, 72rem"
                src={itineraryTimelineImage.src}
              />
            </div>
          ) : (
            <div className="relative flex aspect-21/9 w-full flex-col items-center justify-center border-2 border-citius-orange/25 border-dashed bg-linear-to-br from-brand-light/80 to-brand-light/40 md:aspect-2.4/1">
              <Camera className="mb-2 size-10 text-citius-orange/50" />
              <p className="px-4 text-center font-heading text-brand-muted text-sm">
                {itineraryTimelineImage.caption || "Image placeholder — add your photo here."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute top-0 bottom-0 left-4 w-px bg-linear-to-b from-citius-orange via-citius-blue to-citius-orange/30 md:left-6" />

        {/* Day Cards */}
        <div className="space-y-4 md:space-y-6">
          {itinerary.map((item, idx) => (
            <m.div
              animate={{ opacity: 1, x: 0 }}
              className="relative pl-12 md:pl-16"
              initial={{ opacity: 0, x: -20 }}
              key={item.day || item.title}
              transition={{ delay: idx * 0.05 }}
            >
              {/* Timeline Dot */}
              <div className="absolute top-4 left-2 z-10 flex size-4 items-center justify-center rounded-full border-2 border-citius-orange bg-white shadow-md md:left-4 md:h-5 md:w-5">
                <div className="size-1.5 rounded-full bg-citius-orange" />
              </div>

              {/* Day Card — image + details */}
              <div className="rounded-xl border border-brand-light bg-white shadow-sm transition-[border-color,box-shadow] hover:border-citius-orange/20 hover:shadow-md md:rounded-2xl">
                <div className="flex flex-col gap-4 p-4 md:grid md:grid-cols-5 md:gap-6 md:p-6">
                  <div className="md:col-span-2">
                    <DayItineraryImage dayLabel={item.day || `Day ${idx + 1}`} item={item} />
                  </div>
                  <div className="min-w-0 md:col-span-3">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                      <span className="rounded-full bg-citius-orange/10 px-2.5 py-1 font-bold font-heading text-citius-orange text-xs uppercase tracking-widest">
                        {item.day}
                      </span>
                      {item.altitude && (
                        <span className="flex items-center gap-1 rounded-full bg-brand-light px-2 py-1 text-brand-muted text-xs">
                          <Mountain className="size-3" />
                          {item.altitude}
                        </span>
                      )}
                      {item.trek && (
                        <span className="flex items-center gap-1 rounded-full bg-citius-blue/10 px-2 py-1 text-citius-blue text-xs">
                          <MapPin className="size-3" />
                          {item.trek}
                        </span>
                      )}
                      {item.flight && (
                        <span className="flex items-center gap-1 rounded-full bg-citius-orange/10 px-2 py-1 text-citius-orange text-xs">
                          <Clock className="size-3" />
                          {item.flight}
                        </span>
                      )}
                    </div>

                    <h4 className="mb-2 font-heading text-base text-citius-blue leading-tight md:text-lg">
                      {item.title}
                    </h4>
                    <p className="mb-3 font-sans text-brand-muted text-sm leading-relaxed">
                      {item.desc}
                    </p>

                    {item.highlights && (
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {item.highlights.map((highlight) => (
                          <span
                            className="rounded-full bg-citius-blue/5 px-2 py-1 text-[10px] text-citius-blue/80 md:text-xs"
                            key={highlight}
                          >
                            {highlight}
                          </span>
                        ))}
                      </div>
                    )}

                    {(item.accommodation || item.meals || item.transport) && (
                      <div className="flex flex-wrap gap-3 border-brand-light border-t pt-3 text-brand-muted text-xs">
                        {item.accommodation && (
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3" />
                            {item.accommodation}
                          </span>
                        )}
                        {item.meals && (
                          <span className="flex items-center gap-1">
                            <Coffee className="size-3" />
                            {item.meals}
                          </span>
                        )}
                        {item.transport && (
                          <span className="flex items-center gap-1">
                            <Users className="size-3" />
                            {item.transport}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </m.div>
          ))}
        </div>
      </div>
    </m.div>
  );
}
