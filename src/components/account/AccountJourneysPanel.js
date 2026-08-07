"use client";

import { BedDouble, ChevronLeft, Compass, Plane } from "lucide-react";
import { m } from "motion/react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/application-button";
import {
  ACCOUNT_CONTAINER_VARIANTS,
  CoverImage,
  EmptyInfoCard,
  ItinerarySnapshot,
  JourneyOverviewCard,
  PastJourneyCard,
  TravelInfoCard,
  TravelInfoPlaceholder,
} from "./AccountUi";
import { formatAccountDateRange, getTripDestination, getTripNights } from "./accountPresentation";

function JourneyDetail({ booking, onBack }) {
  const { trip, booking: bookingData } = booking;
  const nights = getTripNights(trip);

  return (
    <m.div
      animate="visible"
      className="space-y-8 sm:space-y-10"
      exit={{ opacity: 0, y: 8 }}
      initial="hidden"
      variants={ACCOUNT_CONTAINER_VARIANTS}
    >
      <Button
        className="inline-flex min-h-0 items-center gap-2 font-semibold text-[var(--account-muted)] text-xs uppercase tracking-[0.12em] hover:text-[var(--account-ink)]"
        onClick={onBack}
        surface="account"
        type="button"
      >
        <ChevronLeft size={16} /> Back to journeys
      </Button>

      <section className="relative min-h-[330px] overflow-hidden rounded-2xl bg-[var(--account-night)] sm:min-h-[460px]">
        <CoverImage sizes="100vw" trip={trip} />
        <div className="absolute inset-0 bg-gradient-to-t from-[color-mix(in_srgb,var(--account-night)_92%,transparent)] via-transparent to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-9">
          <p className="text-sm text-white/70">{getTripDestination(trip)}</p>
          <h2 className="account-display mt-2 text-4xl sm:text-5xl">{trip.name}</h2>
          <p className="mt-3 text-sm text-white/75">
            {formatAccountDateRange(trip.startDate, trip.endDate)} · {bookingData.travelers}{" "}
            traveler
            {bookingData.travelers === 1 ? "" : "s"}
            {nights ? ` · ${nights} night${nights === 1 ? "" : "s"}` : ""}
          </p>
        </div>
      </section>

      <ItinerarySnapshot trip={trip} />
      <div className="grid gap-4 lg:grid-cols-2">
        <TravelInfoCard eyebrow="Flights & PNR" icon={<Plane size={18} />} title="Travel details">
          <TravelInfoPlaceholder kind="flight" trip={trip} />
        </TravelInfoCard>
        <TravelInfoCard eyebrow="Stay" icon={<BedDouble size={18} />} title="Accommodation">
          <TravelInfoPlaceholder kind="stay" trip={trip} />
        </TravelInfoCard>
      </div>
    </m.div>
  );
}

export function AccountJourneysPanel({ upcomingBookings, pastBookings, cancelledBookings = [] }) {
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const selectedBooking = [...upcomingBookings, ...pastBookings, ...cancelledBookings].find(
    (item) => item.booking.id === selectedBookingId
  );
  const closeDetail = useCallback(() => setSelectedBookingId(null), []);
  const openFirstBooking = useCallback(
    () => setSelectedBookingId(upcomingBookings[0]?.booking.id ?? null),
    [upcomingBookings]
  );
  const openBookingFromEvent = useCallback((event) => {
    const { bookingId } = event.currentTarget.dataset;
    if (bookingId) {
      setSelectedBookingId(bookingId);
    }
  }, []);

  if (selectedBooking) {
    return <JourneyDetail booking={selectedBooking} onBack={closeDetail} />;
  }

  const [primaryJourney] = upcomingBookings;

  return (
    <m.div
      animate="visible"
      className="space-y-10 sm:space-y-12"
      exit={{ opacity: 0, y: 8 }}
      initial="hidden"
      variants={ACCOUNT_CONTAINER_VARIANTS}
    >
      <section aria-labelledby="upcoming-journey-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2
            className="account-display text-2xl text-[var(--account-ink)] sm:text-3xl"
            id="upcoming-journey-heading"
          >
            Upcoming journey
          </h2>
          {upcomingBookings.length > 1 ? (
            <span className="text-[var(--account-muted)] text-xs">
              {upcomingBookings.length} journeys
            </span>
          ) : null}
        </div>

        {primaryJourney ? (
          <div className="space-y-4">
            <JourneyOverviewCard booking={primaryJourney} onOpen={openFirstBooking} />
            {upcomingBookings.length > 1 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {upcomingBookings.slice(1).map((booking) => (
                  <PastJourneyCard
                    booking={booking}
                    bookingId={booking.booking.id}
                    key={booking.booking.id}
                    onOpen={openBookingFromEvent}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyInfoCard
            icon={<Compass size={21} />}
            text="When you book your next Citius journey, its dates and itinerary will live here."
            title="No upcoming journeys"
          />
        )}
      </section>

      {primaryJourney ? (
        <section aria-label="Upcoming journey travel details" className="grid gap-4 lg:grid-cols-2">
          <TravelInfoCard eyebrow="Flights & PNR" icon={<Plane size={18} />} title="Travel details">
            <TravelInfoPlaceholder kind="flight" trip={primaryJourney.trip} />
          </TravelInfoCard>
          <TravelInfoCard eyebrow="Stay" icon={<BedDouble size={18} />} title="Accommodation">
            <TravelInfoPlaceholder kind="stay" trip={primaryJourney.trip} />
          </TravelInfoCard>
        </section>
      ) : null}

      <section aria-labelledby="past-journeys-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2
            className="account-display text-2xl text-[var(--account-ink)] sm:text-3xl"
            id="past-journeys-heading"
          >
            Past journeys
          </h2>
          <span className="text-[var(--account-muted)] text-xs">{pastBookings.length}</span>
        </div>
        {pastBookings.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pastBookings.map((booking) => (
              <PastJourneyCard
                booking={booking}
                bookingId={booking.booking.id}
                key={booking.booking.id}
                onOpen={openBookingFromEvent}
              />
            ))}
          </div>
        ) : (
          <p className="border-[var(--account-border)] border-t py-5 text-[var(--account-muted)] text-sm">
            Your completed journeys will collect here.
          </p>
        )}
      </section>

      {cancelledBookings.length > 0 ? (
        <section aria-labelledby="cancelled-journeys-heading">
          <h2
            className="mb-4 font-semibold text-[var(--account-muted)] text-xs uppercase tracking-[0.16em]"
            id="cancelled-journeys-heading"
          >
            Cancelled journeys
          </h2>
          <div className="grid gap-4 opacity-70 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cancelledBookings.map((booking) => (
              <PastJourneyCard
                booking={booking}
                bookingId={booking.booking.id}
                key={booking.booking.id}
                onOpen={openBookingFromEvent}
              />
            ))}
          </div>
        </section>
      ) : null}
    </m.div>
  );
}
