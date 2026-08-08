import type { Doc } from "./_generated/dataModel";

export type CustomerJourneyCategory = "cancelled" | "past" | "upcoming";

interface JourneyImage {
  alt: string;
  src: string;
}

interface JourneyItineraryEntry {
  accommodation: string;
  day: string;
  desc: string;
  key: string;
  location: string;
  meals: string;
  title: string;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function dateOnly(value: unknown) {
  const match = cleanText(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function referenceDateOnly(referenceNow: number) {
  return new Date(referenceNow).toISOString().slice(0, 10);
}

export function normalizeJourneyItinerary(value: unknown): JourneyItineraryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((candidate, index) => {
    if (!(candidate && typeof candidate === "object")) {
      return [];
    }
    const entry = candidate as Record<string, unknown>;
    const day = cleanText(entry.day) || `Day ${index + 1}`;
    const title = cleanText(entry.title) || "Journey highlight";
    return [
      {
        accommodation: cleanText(entry.accommodation),
        day,
        desc: cleanText(entry.desc),
        key: `${day}-${title}-${index + 1}`,
        location: cleanText(entry.location) || cleanText(entry.destination),
        meals: cleanText(entry.meals),
        title,
      },
    ];
  });
}

export function normalizeJourneyImages(trip: Doc<"trips"> | null): JourneyImage[] {
  if (!trip) {
    return [];
  }
  const tripName = cleanText(trip.name) || "Journey";
  const candidates: JourneyImage[] = [];
  const coverImage = cleanText(trip.coverImage);
  if (coverImage) {
    candidates.push({ alt: tripName, src: coverImage });
  }
  if (Array.isArray(trip.gallery)) {
    for (const candidate of trip.gallery) {
      if (typeof candidate === "string") {
        const src = cleanText(candidate);
        if (src) {
          candidates.push({ alt: `${tripName} highlight`, src });
        }
      } else if (candidate && typeof candidate === "object") {
        const image = candidate as Record<string, unknown>;
        const src = cleanText(image.src);
        if (src) {
          candidates.push({ alt: cleanText(image.alt) || `${tripName} highlight`, src });
        }
      }
    }
  }
  return candidates.filter(
    (candidate, index) => candidates.findIndex((other) => other.src === candidate.src) === index
  );
}

export function classifyCustomerJourney(
  booking: Pick<Doc<"bookings">, "status">,
  trip: Pick<Doc<"trips">, "endDate" | "startDate"> | null,
  referenceNow: number
): CustomerJourneyCategory {
  if (["cancelled", "failed", "refunded"].includes(booking.status)) {
    return "cancelled";
  }
  const journeyEnd = dateOnly(trip?.endDate) ?? dateOnly(trip?.startDate);
  if (journeyEnd && journeyEnd < referenceDateOnly(referenceNow)) {
    return "past";
  }
  return "upcoming";
}

function customerBooking(booking: Doc<"bookings">) {
  return {
    confirmedAt: booking.confirmedAt ? new Date(booking.confirmedAt).toISOString() : null,
    createdAt: new Date(booking.createdAt).toISOString(),
    currency: booking.currency,
    id: booking._id,
    status: booking.status,
    totalAmount: booking.totalAmount,
    travelers: booking.travelers,
    tripId: booking.tripId,
    updatedAt: new Date(booking.updatedAt).toISOString(),
  };
}

function summaryTrip(trip: Doc<"trips"> | null) {
  const images = normalizeJourneyImages(trip);
  return {
    coverImage: images[0]?.src ?? "",
    endDate: trip?.endDate ?? "",
    gallery: images.slice(1, 3),
    itinerary: normalizeJourneyItinerary(trip?.itinerary).slice(0, 4),
    name: cleanText(trip?.name) || "Journey details unavailable",
    slug: cleanText(trip?.slug),
    startDate: trip?.startDate ?? "",
  };
}

function cleanTextList(values: unknown[]): string[] {
  return values.flatMap((value) => {
    const cleaned = cleanText(value);
    return cleaned ? [cleaned] : [];
  });
}

export function projectCustomerJourneySummary(
  booking: Doc<"bookings">,
  trip: Doc<"trips"> | null,
  referenceNow: number
) {
  return {
    booking: customerBooking(booking),
    category: classifyCustomerJourney(booking, trip, referenceNow),
    detailAvailable: Boolean(trip),
    trip: summaryTrip(trip),
  };
}

export function projectCustomerJourneyDetail(
  booking: Doc<"bookings">,
  trip: Doc<"trips"> | null,
  referenceNow: number
) {
  const summary = projectCustomerJourneySummary(booking, trip, referenceNow);
  if (!trip) {
    return {
      ...summary,
      trip: { ...summary.trip, description: "", exclusions: [], inclusions: [] },
    };
  }
  return {
    ...summary,
    trip: {
      ...summary.trip,
      description: cleanText(trip.description),
      exclusions: Array.isArray(trip.exclusions) ? cleanTextList(trip.exclusions) : [],
      gallery: normalizeJourneyImages(trip).slice(1),
      inclusions: Array.isArray(trip.inclusions) ? cleanTextList(trip.inclusions) : [],
      itinerary: normalizeJourneyItinerary(trip.itinerary),
    },
  };
}

function journeySortValue(item: ReturnType<typeof projectCustomerJourneySummary>) {
  const start = dateOnly(item.trip.startDate);
  const end = dateOnly(item.trip.endDate);
  if (item.category === "upcoming") {
    return start ?? "9999-12-31";
  }
  if (item.category === "past") {
    return end ?? start ?? "0000-00-00";
  }
  return item.booking.createdAt;
}

export function sortCustomerJourneySummaries(
  summaries: ReturnType<typeof projectCustomerJourneySummary>[]
) {
  const rank: Record<CustomerJourneyCategory, number> = { cancelled: 2, past: 1, upcoming: 0 };
  return [...summaries].sort((left, right) => {
    const rankDifference = rank[left.category] - rank[right.category];
    if (rankDifference) {
      return rankDifference;
    }
    const leftValue = journeySortValue(left);
    const rightValue = journeySortValue(right);
    const direction = left.category === "upcoming" ? 1 : -1;
    return leftValue.localeCompare(rightValue) * direction;
  });
}
