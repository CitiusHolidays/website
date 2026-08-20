"use client";

import { BedDouble, ChevronLeft, Compass, Plane } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/application-button";
import { isRuntimeBoolean, isRuntimeObject, isRuntimeString } from "../../lib/runtimeValues";
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
        className="inline-flex min-h-11 items-center gap-2 font-semibold text-[var(--account-muted)] text-xs uppercase tracking-[0.12em] hover:text-[var(--account-ink)]"
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

async function loadSelectedJourney(bookingId, referenceNow) {
  const query = Number.isFinite(referenceNow) ? `?referenceNow=${referenceNow}` : "";
  const response = await fetch(`/api/account/journeys/${encodeURIComponent(bookingId)}${query}`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("Journey details could not be loaded");
  }
  return await response.json();
}

async function loadNextConfirmedTripPage(cursor) {
  const response = await fetch(
    `/api/account/confirmed-trips?cursor=${encodeURIComponent(cursor)}`,
    { headers: { accept: "application/json" } }
  );
  if (!response.ok) {
    throw new Error("Confirmed trips could not be loaded");
  }
  const page = await response.json();
  if (
    !(
      page &&
      isRuntimeObject(page) &&
      Array.isArray(page.page) &&
      isRuntimeString(page.continueCursor) &&
      isRuntimeBoolean(page.isDone)
    )
  ) {
    throw new Error("Confirmed trip response was invalid");
  }
  return page;
}

export function mergeConfirmedTripPackets(current, incoming) {
  const packetsByOffer = new Map();
  for (const packet of [...current, ...incoming]) {
    if (packet?.confirmedOfferId) {
      packetsByOffer.set(packet.confirmedOfferId, packet);
    }
  }
  return [...packetsByOffer.values()].sort((left, right) =>
    right.travelStartDate.localeCompare(left.travelStartDate)
  );
}

function JourneyDetailPending({ error, onBack }) {
  return (
    <div className="account-card rounded-2xl p-6 sm:p-8">
      <Button
        className="inline-flex min-h-11 items-center gap-2 font-semibold text-[var(--account-muted)] text-xs uppercase tracking-[0.12em] hover:text-[var(--account-ink)]"
        onClick={onBack}
        surface="account"
        type="button"
      >
        <ChevronLeft size={16} /> Back to journeys
      </Button>
      <p className="mt-6 text-[var(--account-muted)] text-sm" role={error ? "alert" : "status"}>
        {error || "Loading journey details…"}
      </p>
    </div>
  );
}

function ConfirmedTripPackets({ hasMore, isLoadingMore, loadError, onLoadMore, packets }) {
  if (!(packets.length || hasMore)) {
    return null;
  }
  return (
    <section aria-labelledby="confirmed-trip-packets-heading">
      <div className="mb-4">
        <p className="font-semibold text-[10px] text-[var(--account-gold)] uppercase tracking-[0.16em]">
          Read-only travel record
        </p>
        <h2
          className="account-display mt-1 text-2xl text-[var(--account-ink)] sm:text-3xl"
          id="confirmed-trip-packets-heading"
        >
          Confirmed trip packet
        </h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {packets.map((packet) => (
          <article className="account-card rounded-2xl p-6" key={packet.confirmedOfferId}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[var(--account-muted)] text-xs">{packet.queryCode}</p>
                <h3 className="account-display mt-1 text-2xl text-[var(--account-ink)]">
                  {packet.destination}
                </h3>
                <p className="mt-1 text-[var(--account-muted)] text-xs">
                  {packet.entitlement?.role === "organizer"
                    ? "Organizer access"
                    : "Traveller access"}
                </p>
              </div>
              <span className="rounded-full bg-[var(--account-success-bg)] px-3 py-1.5 font-semibold text-[var(--account-success)] text-xs">
                Confirmed
              </span>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-4 border-[var(--account-border)] border-t pt-4 text-sm">
              <div>
                <dt className="text-[var(--account-muted)] text-xs">Travel dates</dt>
                <dd className="mt-1 text-[var(--account-ink)]">
                  {formatAccountDateRange(packet.travelStartDate, packet.travelEndDate)}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--account-muted)] text-xs">Travellers</dt>
                <dd className="mt-1 text-[var(--account-ink)]">{packet.confirmedPax}</dd>
              </div>
              <div>
                <dt className="text-[var(--account-muted)] text-xs">Job card</dt>
                <dd className="mt-1 text-[var(--account-ink)]">
                  {packet.jobCode || "In preparation"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--account-muted)] text-xs">Preparation status</dt>
                <dd className="mt-1 text-[var(--account-ink)]">
                  {packet.jobStatus || "Confirmed offer received"}
                </dd>
              </div>
            </dl>
            {packet.itinerary ? (
              <details className="mt-5 border-[var(--account-border)] border-t pt-4">
                <summary className="cursor-pointer font-medium text-[var(--account-ink)] text-sm">
                  {packet.itinerary.title}
                </summary>
                <p className="mt-3 whitespace-pre-wrap text-[var(--account-muted)] text-sm leading-6">
                  {packet.itinerary.content || "Your frozen itinerary is being finalized."}
                </p>
              </details>
            ) : null}
            <p className="mt-5 text-[var(--account-muted)] text-xs leading-5">
              This packet reflects the confirmed Citius record and cannot change staff, payment,
              passport, or visa records.
            </p>
          </article>
        ))}
      </div>
      {loadError ? (
        <p className="mt-4 text-[#9b3d32] text-sm" role="alert">
          {loadError}
        </p>
      ) : null}
      {hasMore ? (
        <Button
          aria-busy={isLoadingMore}
          className="mt-5 min-h-11 px-5 font-semibold text-sm"
          disabled={isLoadingMore}
          onClick={onLoadMore}
          surface="account"
          type="button"
        >
          {isLoadingMore ? "Loading confirmed trips…" : "Load more confirmed trips"}
        </Button>
      ) : null}
    </section>
  );
}

function JourneyOverview({
  cancelledBookings,
  confirmedTrips,
  confirmedTripsHasMore,
  confirmedTripsLoadError,
  confirmedTripsLoading,
  onLoadMoreConfirmedTrips,
  onOpenBooking,
  onOpenFirstBooking,
  pastBookings,
  upcomingBookings,
}) {
  const [primaryJourney] = upcomingBookings;
  return (
    <m.div
      animate="visible"
      className="space-y-10 sm:space-y-12"
      exit={{ opacity: 0, y: 8 }}
      initial="hidden"
      key="journey-overview"
      variants={ACCOUNT_CONTAINER_VARIANTS}
    >
      <ConfirmedTripPackets
        hasMore={confirmedTripsHasMore}
        isLoadingMore={confirmedTripsLoading}
        loadError={confirmedTripsLoadError}
        onLoadMore={onLoadMoreConfirmedTrips}
        packets={confirmedTrips}
      />
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
            <JourneyOverviewCard booking={primaryJourney} onOpen={onOpenFirstBooking} />
            {upcomingBookings.length > 1 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {upcomingBookings.slice(1).map((booking) => (
                  <PastJourneyCard
                    booking={booking}
                    bookingId={booking.booking.id}
                    key={booking.booking.id}
                    onOpen={onOpenBooking}
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
                onOpen={onOpenBooking}
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
                onOpen={onOpenBooking}
              />
            ))}
          </div>
        </section>
      ) : null}
    </m.div>
  );
}

export function AccountJourneysPanel({
  upcomingBookings,
  pastBookings,
  cancelledBookings = [],
  confirmedTrips = [],
  confirmedTripsCursor = "",
  confirmedTripsDone = true,
  referenceNow,
  loadJourneyDetail = loadSelectedJourney,
  loadConfirmedTripsPage = loadNextConfirmedTripPage,
}) {
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [loadedConfirmedTrips, setLoadedConfirmedTrips] = useState(() =>
    mergeConfirmedTripPackets([], confirmedTrips)
  );
  const confirmedTripCursor = useRef(confirmedTripsCursor);
  const [confirmedTripDone, setConfirmedTripDone] = useState(confirmedTripsDone);
  const [confirmedTripsLoading, setConfirmedTripsLoading] = useState(false);
  const [confirmedTripsLoadError, setConfirmedTripsLoadError] = useState("");
  const detailRequestId = useRef(0);
  const closeDetail = () => {
    detailRequestId.current += 1;
    setSelectedBookingId(null);
    setSelectedBooking(null);
    setDetailError("");
  };
  const openBooking = async (bookingId) => {
    if (!bookingId) {
      return;
    }
    setSelectedBookingId(bookingId);
    setSelectedBooking(null);
    setDetailError("");
    const requestId = detailRequestId.current + 1;
    detailRequestId.current = requestId;
    try {
      const detail = await loadJourneyDetail(bookingId, referenceNow);
      if (detailRequestId.current !== requestId) {
        return;
      }
      setSelectedBooking(detail);
      if (!detail) {
        setDetailError("Journey details are no longer available.");
      }
    } catch {
      if (detailRequestId.current === requestId) {
        setDetailError("Journey details could not be loaded. Please try again.");
      }
    }
  };
  const openFirstBooking = () => {
    openBooking(upcomingBookings[0]?.booking.id);
  };
  const openBookingFromEvent = (event) => {
    const { bookingId } = event.currentTarget.dataset;
    if (bookingId) {
      openBooking(bookingId);
    }
  };
  const loadMoreConfirmedTrips = async () => {
    const cursor = confirmedTripCursor.current;
    if (confirmedTripsLoading || confirmedTripDone || !cursor) {
      return;
    }
    setConfirmedTripsLoading(true);
    setConfirmedTripsLoadError("");
    try {
      const page = await loadConfirmedTripsPage(cursor);
      setLoadedConfirmedTrips((current) => mergeConfirmedTripPackets(current, page.page));
      confirmedTripCursor.current = page.continueCursor;
      setConfirmedTripDone(page.isDone);
    } catch {
      setConfirmedTripsLoadError("More confirmed trips could not be loaded. Please try again.");
    }
    setConfirmedTripsLoading(false);
  };

  let content = (
    <JourneyOverview
      cancelledBookings={cancelledBookings}
      confirmedTrips={loadedConfirmedTrips}
      confirmedTripsHasMore={!confirmedTripDone}
      confirmedTripsLoadError={confirmedTripsLoadError}
      confirmedTripsLoading={confirmedTripsLoading}
      key="journey-overview"
      onLoadMoreConfirmedTrips={loadMoreConfirmedTrips}
      onOpenBooking={openBookingFromEvent}
      onOpenFirstBooking={openFirstBooking}
      pastBookings={pastBookings}
      upcomingBookings={upcomingBookings}
    />
  );
  if (selectedBookingId) {
    content = (
      <JourneyDetailPending error={detailError} key="journey-detail-pending" onBack={closeDetail} />
    );
  }
  if (selectedBooking) {
    content = (
      <JourneyDetail
        booking={selectedBooking}
        key={selectedBooking.booking.id}
        onBack={closeDetail}
      />
    );
  }

  return (
    <AnimatePresence initial={false} mode="sync">
      {content}
    </AnimatePresence>
  );
}
