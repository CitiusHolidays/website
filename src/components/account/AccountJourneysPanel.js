"use client";

import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Info,
  MapPin,
  Route,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatDisplayDate } from "@/lib/formatDate";
import {
  AccountStateCard,
  BookingCard,
  FlightIcon,
  formatBookingAmount,
  getBookingPresentation,
  StatusPill,
  TravelSummary,
} from "./AccountUi";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function itineraryEntries(trip) {
  if (!Array.isArray(trip?.itinerary)) {
    return [];
  }

  return trip.itinerary.flatMap((entry, index) => {
    if (typeof entry === "string") {
      return [{ description: entry, id: `itinerary-${index}`, title: `Day ${index + 1}` }];
    }
    if (!isObject(entry)) {
      return [];
    }
    const title =
      asText(entry.title) || asText(entry.name) || asText(entry.location) || `Day ${index + 1}`;
    const description = asText(entry.description) || asText(entry.desc) || asText(entry.summary);
    const date = asText(entry.date) || asText(entry.day);
    return [{ date, description, id: `itinerary-${index}`, title }];
  });
}

function customerTravelDetails(bookingData) {
  // `travelerDetails` is intentionally omitted from the current customer
  // return contract. This allow-list keeps a future safe projection narrow if
  // flight/stay data is added later, rather than spreading operational data.
  const details = isObject(bookingData?.customerTravelDetails)
    ? bookingData.customerTravelDetails
    : {};
  const flight = isObject(details.flight) ? details.flight : {};
  const stay = isObject(details.stay) ? details.stay : {};
  return {
    airline: asText(flight.airline),
    arrival: asText(flight.arrival),
    departure: asText(flight.departure),
    flightNumber: asText(flight.flightNumber),
    hotel: asText(stay.hotel),
    roomType: asText(stay.roomType),
  };
}

function AvailabilityNote({ children }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-slate-600 text-sm leading-relaxed">
      <Info aria-hidden="true" className="mt-0.5 shrink-0 text-citius-orange" size={17} />
      <p>{children}</p>
    </div>
  );
}

function DetailPanel({ children, icon: Icon, title }) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-slate-100 text-brand-dark">
          <Icon aria-hidden="true" size={19} />
        </span>
        <h2 className="font-heading text-2xl text-brand-dark">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function JourneyDetailPanel({ booking, referenceNow = 0 }) {
  const trip = booking?.trip || {};
  const bookingData = booking?.booking || {};
  const isPast = Date.parse(trip.endDate || trip.startDate || "") < referenceNow;
  const entries = itineraryEntries(trip);
  const details = customerTravelDetails(bookingData);
  const presentation = getBookingPresentation(bookingData, { isPast });

  return (
    <div className="space-y-6">
      <Link
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 font-semibold text-brand-dark text-sm transition-colors duration-150 hover:text-citius-orange focus-visible:outline-2 focus-visible:outline-citius-orange focus-visible:outline-offset-2"
        href="/account"
      >
        <ArrowLeft aria-hidden="true" size={17} />
        Back to journeys
      </Link>

      <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <div className="grid min-w-0 lg:grid-cols-[minmax(15rem,0.85fr)_minmax(0,1.35fr)]">
          <div className="relative aspect-[16/10] min-h-56 bg-slate-100 lg:aspect-auto lg:min-h-80">
            {trip.coverImage ? (
              <Image
                alt={trip.name ? `${trip.name} destination` : "Journey destination"}
                className="size-full object-cover"
                fill
                sizes="(max-width: 1024px) 100vw, 40vw"
                src={trip.coverImage}
              />
            ) : (
              <div className="flex size-full items-center justify-center text-slate-400">
                <Route aria-hidden="true" size={34} />
              </div>
            )}
          </div>
          <div className="min-w-0 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold text-citius-orange text-xs uppercase tracking-[0.12em]">
                Journey details
              </p>
              <StatusPill bookingData={bookingData} isPast={isPast} />
            </div>
            <h1 className="mt-4 text-balance font-heading text-3xl text-brand-dark sm:text-4xl">
              {trip.name || "Unnamed journey"}
            </h1>
            <p className="mt-3 max-w-2xl text-pretty text-slate-600 leading-relaxed">
              {trip.description ||
                "Your Citius travel team will share more details here as they are ready."}
            </p>

            <dl className="mt-7 grid gap-5 border-slate-100 border-t pt-6 sm:grid-cols-2">
              <TravelSummary
                icon={CalendarDays}
                label="Travel dates"
                value={`${formatDisplayDateSafe(trip.startDate)} – ${formatDisplayDateSafe(trip.endDate)}`}
              />
              <TravelSummary
                icon={MapPin}
                label="Booking reference"
                value={bookingData.id ? `${bookingData.id.slice(0, 10)}…` : "Pending"}
              />
              <TravelSummary icon={Clock3} label="Booking status" value={presentation.label} />
              <TravelSummary
                icon={CheckCircle2}
                label="Amount"
                value={formatBookingAmount(bookingData.currency, bookingData.totalAmount)}
              />
            </dl>
          </div>
        </div>
      </section>

      <DetailPanel icon={Route} title="Itinerary">
        {entries.length > 0 ? (
          <ol className="relative space-y-0 before:absolute before:top-3 before:bottom-3 before:left-[0.9rem] before:w-px before:bg-slate-200">
            {entries.map((entry) => (
              <li className="relative flex gap-4 pb-6 last:pb-0" key={entry.id}>
                <span className="relative z-10 mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-citius-orange bg-white text-citius-orange">
                  <span className="size-2 rounded-full bg-citius-orange" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-brand-dark">{entry.title}</p>
                  {Boolean(entry.date) && (
                    <p className="mt-1 text-slate-500 text-xs">{entry.date}</p>
                  )}
                  {Boolean(entry.description) && (
                    <p className="mt-2 text-pretty text-slate-600 text-sm leading-relaxed">
                      {entry.description}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <AvailabilityNote>
            Your itinerary is not available yet. The Citius team will add the day-by-day details
            here once they are ready.
          </AvailabilityNote>
        )}
      </DetailPanel>

      <div className="grid gap-6 lg:grid-cols-2">
        <DetailPanel icon={FlightIcon} title="Flights & PNR">
          {details.flightNumber || details.airline || details.departure || details.arrival ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TravelSummary label="Flight" value={details.flightNumber} />
                <TravelSummary label="Airline" value={details.airline} />
                <TravelSummary label="Departure" value={details.departure} />
                <TravelSummary label="Arrival" value={details.arrival} />
              </div>
              <AvailabilityNote>Flight information is read-only in your Account.</AvailabilityNote>
            </div>
          ) : (
            <AvailabilityNote>
              Flight and PNR information will appear here when the travel team has confirmed it.
            </AvailabilityNote>
          )}
        </DetailPanel>

        <DetailPanel icon={BedDouble} title="Stay">
          {details.hotel || details.roomType ? (
            <div className="space-y-4">
              <TravelSummary icon={BedDouble} label="Hotel" value={details.hotel} />
              <TravelSummary icon={BedDouble} label="Room" value={details.roomType} />
              <AvailabilityNote>
                Accommodation information is read-only in your Account.
              </AvailabilityNote>
            </div>
          ) : (
            <AvailabilityNote>
              Hotel and room information will appear here when the travel team has confirmed it.
            </AvailabilityNote>
          )}
        </DetailPanel>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-slate-50 p-5 text-slate-600 text-sm leading-relaxed sm:p-6">
        <p>
          Need to change something about this journey? Contact the Citius team and mention your
          booking reference. This Account is read-only so your travel records stay accurate.
        </p>
        <Link
          className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-brand-dark transition-colors duration-150 hover:text-citius-orange focus-visible:outline-2 focus-visible:outline-citius-orange focus-visible:outline-offset-2"
          href="/contact"
        >
          Contact the travel team <ArrowLeft aria-hidden="true" className="rotate-180" size={16} />
        </Link>
      </div>
    </div>
  );
}

function formatDisplayDateSafe(value) {
  return value ? formatDisplayDate(value) : "Date to be confirmed";
}

function SectionHeading({ count, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="font-heading text-2xl text-brand-dark sm:text-3xl">{children}</h2>
      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-500 text-xs tabular-nums">
        {count}
      </span>
    </div>
  );
}

export function AccountJourneysPanel({
  upcomingBookings = [],
  pastBookings = [],
  cancelledBookings = [],
}) {
  const hasBookings = Boolean(
    upcomingBookings.length || pastBookings.length || cancelledBookings.length
  );

  return (
    <div className="space-y-10" id="account-content">
      <div>
        <p className="font-semibold text-citius-orange text-xs uppercase tracking-[0.12em]">
          Your travel
        </p>
        <h2 className="mt-2 text-balance font-heading text-3xl text-brand-dark sm:text-4xl">
          Journeys made clear
        </h2>
        <p className="mt-3 max-w-2xl text-pretty text-slate-600 leading-relaxed">
          Open a journey for the details we have ready, or contact the team when you need a hand.
        </p>
      </div>

      {hasBookings ? (
        <>
          {upcomingBookings.length > 0 && (
            <section>
              <SectionHeading count={upcomingBookings.length}>Upcoming journeys</SectionHeading>
              <div className="grid gap-5">
                {upcomingBookings.map((booking) => (
                  <BookingCard booking={booking} key={booking.booking.id} type="upcoming" />
                ))}
              </div>
            </section>
          )}

          {pastBookings.length > 0 && (
            <section>
              <SectionHeading count={pastBookings.length}>Past journeys</SectionHeading>
              <div className="grid gap-5">
                {pastBookings.map((booking) => (
                  <BookingCard booking={booking} key={booking.booking.id} type="past" />
                ))}
              </div>
            </section>
          )}

          {cancelledBookings.length > 0 && (
            <section>
              <SectionHeading count={cancelledBookings.length}>Cancelled journeys</SectionHeading>
              <div className="grid gap-5">
                {cancelledBookings.map((booking) => (
                  <BookingCard booking={booking} key={booking.booking.id} type="cancelled" />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <AccountStateCard
          action={
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-dark px-5 py-2.5 font-semibold text-sm text-white transition-[background-color,transform] duration-150 fine-hover:hover:-translate-y-px hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-citius-orange focus-visible:outline-offset-2"
              href="/services"
            >
              Explore journeys <Route aria-hidden="true" size={16} />
            </Link>
          }
          description="Your confirmed and upcoming bookings will appear here. When you are ready, explore the journeys Citius can arrange for you."
          icon={Route}
          title="Your next journey starts here"
        />
      )}
    </div>
  );
}
