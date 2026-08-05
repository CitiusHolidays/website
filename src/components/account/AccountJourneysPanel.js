"use client";

import { BedDouble, ChevronLeft, Compass, Plane } from "lucide-react";
import { m } from "motion/react";
import { useState } from "react";
import {
  ACCOUNT_CONTAINER_VARIANTS,
  EmptyInfoCard,
  ItinerarySnapshot,
  JourneyOverviewCard,
  normalizeItinerary,
  PastJourneyCard,
  TravelInfoCard,
} from "./AccountUi";

function JourneyDetail({ booking, onBack }) {
  const { trip, booking: bookingData } = booking;
  const itinerary = normalizeItinerary(trip.itinerary);
  const firstStay = itinerary.find((entry) => entry.accommodation)?.accommodation;
  return (
    <m.div
      animate="visible"
      className="space-y-10"
      exit={{ opacity: 0, y: 8 }}
      initial="hidden"
      variants={ACCOUNT_CONTAINER_VARIANTS}
    >
      <button
        className="account-focus inline-flex items-center gap-2 font-semibold text-[var(--account-muted)] text-xs uppercase tracking-[0.12em] hover:text-[var(--account-ink)]"
        onClick={onBack}
        type="button"
      >
        <ChevronLeft size={16} /> Back to journeys
      </button>
      <div>
        <p className="mb-2 font-semibold text-[10px] text-[var(--account-gold)] uppercase tracking-[0.2em]">
          Journey details
        </p>
        <h2 className="account-display text-4xl text-[var(--account-ink)] sm:text-5xl">
          {trip.name}
        </h2>
        <p className="mt-3 text-[var(--account-muted)] text-sm">
          {trip.startDate} — {trip.endDate} · {bookingData.travelers} traveler
          {bookingData.travelers === 1 ? "" : "s"}
        </p>
      </div>
      <ItinerarySnapshot trip={trip} />
      <div className="grid gap-5 md:grid-cols-2">
        <TravelInfoCard eyebrow="Flights & PNR" icon={<Plane size={17} />} title="Travel details">
          <p>Your flight and PNR details will appear here once the travel desk confirms them.</p>
          <p className="mt-3 text-[var(--account-muted)] text-xs">
            We&apos;ll keep this page current as your plans progress.
          </p>
        </TravelInfoCard>
        <TravelInfoCard eyebrow="Stay" icon={<BedDouble size={17} />} title="Accommodation">
          <p>{firstStay || "Your stay details are being arranged by the Citius travel desk."}</p>
          <p className="mt-3 text-[var(--account-muted)] text-xs">
            Room and check-in information will be added here when confirmed.
          </p>
        </TravelInfoCard>
      </div>
    </m.div>
  );
}

export function AccountJourneysPanel({ upcomingBookings, pastBookings, cancelledBookings = [] }) {
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const selectedBooking = upcomingBookings.find((item) => item.booking.id === selectedBookingId);
  const closeDetail = () => setSelectedBookingId(null);
  const openFirstBooking = () => setSelectedBookingId(upcomingBookings[0]?.booking.id ?? null);

  if (selectedBooking) {
    return <JourneyDetail booking={selectedBooking} onBack={closeDetail} />;
  }

  return (
    <m.div
      animate="visible"
      className="space-y-14"
      exit={{ opacity: 0, y: 8 }}
      initial="hidden"
      variants={ACCOUNT_CONTAINER_VARIANTS}
    >
      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="mb-1 font-semibold text-[10px] text-[var(--account-gold)] uppercase tracking-[0.2em]">
              The next chapter
            </p>
            <h2 className="account-display text-3xl text-[var(--account-ink)]">Upcoming journey</h2>
          </div>
          {upcomingBookings.length > 1 && (
            <span className="text-[var(--account-muted)] text-xs">
              {upcomingBookings.length} journeys
            </span>
          )}
        </div>
        {upcomingBookings.length > 0 ? (
          <div className="space-y-5">
            {upcomingBookings.slice(0, 1).map((booking) => (
              <JourneyOverviewCard
                booking={booking}
                key={booking.booking.id}
                onOpen={openFirstBooking}
              />
            ))}
            {upcomingBookings.length > 1 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {upcomingBookings.slice(1).map((booking) => (
                  <PastJourneyCard booking={booking} key={booking.booking.id} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <EmptyInfoCard
            icon={<Compass size={21} />}
            text="When you book your next Citius journey, its dates and itinerary will live here."
            title="No upcoming journeys"
          />
        )}
      </section>

      {!!upcomingBookings[0] && (
        <section>
          <ItinerarySnapshot trip={upcomingBookings[0].trip} />
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <TravelInfoCard
              eyebrow="Flights & PNR"
              icon={<Plane size={17} />}
              title="Travel details"
            >
              <p>Flight details will appear here once confirmed by your travel desk.</p>
            </TravelInfoCard>
            <TravelInfoCard eyebrow="Stay" icon={<BedDouble size={17} />} title="Accommodation">
              <p>Stay details will appear here as your itinerary is finalized.</p>
            </TravelInfoCard>
          </div>
        </section>
      )}

      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="mb-1 font-semibold text-[10px] text-[var(--account-gold)] uppercase tracking-[0.2em]">
              A look back
            </p>
            <h2 className="account-display text-3xl text-[var(--account-ink)]">Past journeys</h2>
          </div>
          <span className="text-[var(--account-muted)] text-xs">{pastBookings.length}</span>
        </div>
        {pastBookings.length ? (
          <div className="grid gap-3">
            {pastBookings.map((booking) => (
              <PastJourneyCard booking={booking} key={booking.booking.id} />
            ))}
          </div>
        ) : (
          <p className="text-[var(--account-muted)] text-sm">
            Your completed journeys will collect here.
          </p>
        )}
      </section>

      {cancelledBookings.length > 0 && (
        <section>
          <p className="mb-3 font-semibold text-[10px] text-[var(--account-muted)] uppercase tracking-[0.2em]">
            Cancelled
          </p>
          <div className="grid gap-3 opacity-70">
            {cancelledBookings.map((booking) => (
              <PastJourneyCard booking={booking} key={booking.booking.id} />
            ))}
          </div>
        </section>
      )}
    </m.div>
  );
}
