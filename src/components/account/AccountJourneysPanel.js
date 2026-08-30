"use client";

import { BedDouble, ChevronLeft, Compass, Download, Plane } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
import {
  formatAccountDate,
  formatAccountDateRange,
  getTripDestination,
  getTripNights,
} from "./accountPresentation";

function JourneyDetail({ booking, focusRef, onBack }) {
  const { trip, booking: bookingData } = booking;
  const nights = getTripNights(trip);

  useEffect(() => {
    const frame = requestAnimationFrame(() => focusRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [focusRef]);

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
          <h2
            className="account-display mt-2 text-4xl outline-none sm:text-5xl"
            ref={focusRef}
            tabIndex={-1}
          >
            {trip.name}
          </h2>
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

async function loadSelectedJourney(journeyKey) {
  const response = await fetch(`/api/account/journeys/${encodeURIComponent(journeyKey)}`, {
    headers: { accept: "application/json" },
  });
  if (response.status === 404) {
    const error = new Error("Journey is no longer available");
    error.code = "ACCOUNT_JOURNEY_UNAVAILABLE";
    throw error;
  }
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
    (right.travel?.startDate || "").localeCompare(left.travel?.startDate || "")
  );
}

function JourneyDetailPending({ error, focusRef, onBack, onRetry }) {
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
      <p
        aria-atomic="true"
        className="mt-6 text-[var(--account-muted)] text-sm outline-none"
        ref={focusRef}
        role={error ? "alert" : "status"}
        tabIndex={-1}
      >
        {error || "Loading journey details…"}
      </p>
      {error ? (
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            className="min-h-11 rounded-full bg-[var(--account-night)] px-5 font-semibold text-sm text-white"
            onClick={onRetry}
            surface="account"
            type="button"
          >
            Try again
          </Button>
          <Link
            className="account-focus inline-flex min-h-11 items-center rounded-full border border-[var(--account-night)] px-5 font-semibold text-[var(--account-night)] text-sm"
            href="/contact"
          >
            Get help
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function JourneyRecoveryNotice() {
  return (
    <div
      className="account-card rounded-2xl border-[#e7c8c3] bg-[#fff7f5] p-5 outline-none"
      id="account-journey-recovery"
      role="alert"
      tabIndex={-1}
    >
      <p className="font-semibold text-[var(--account-ink)] text-sm">
        That Account link is no longer available.
      </p>
      <p className="mt-1 text-[var(--account-muted)] text-sm leading-6">
        Your current journeys are shown below. Account links never change who can view a journey.
      </p>
      <Link
        className="account-focus mt-3 inline-flex min-h-11 items-center rounded-full border border-[var(--account-night)] px-4 font-semibold text-[var(--account-night)] text-sm"
        href="/contact"
      >
        Contact Citius
      </Link>
    </div>
  );
}

function Freshness({ at }) {
  if (!Number.isFinite(at)) {
    return <span>Freshness: Unknown</span>;
  }
  return (
    <span>
      As of <time dateTime={new Date(at).toISOString()}>{formatAccountDate(at)}</time>
    </span>
  );
}

function ReadinessMilestone({ at, children, ready }) {
  return (
    <li className="min-w-0 border-[var(--account-border)] border-t pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-medium text-[var(--account-ink)] text-sm">{children}</span>
        <strong
          className={
            ready ? "text-[var(--account-success)] text-xs" : "text-[var(--account-gold)] text-xs"
          }
        >
          {ready ? "Ready" : "Pending — Unknown"}
        </strong>
      </div>
      <p className="mt-1 text-[var(--account-muted)] text-xs">
        <Freshness at={at} />
      </p>
    </li>
  );
}

const REMINDER_MILESTONES = [
  ["arrival_pack_ready", "Arrival Pack ready"],
  ["confirmed_travel_summary_ready", "Confirmed travel summary ready"],
];
const REMINDER_LABELS = new Map(REMINDER_MILESTONES);
const REMINDER_DELIVERY_COPY = {
  accepted: "in progress",
  ambiguous: "outcome unresolved; no fallback",
  blocked: "not sent",
  delivered: "delivered",
  failed: "failed",
  filtered: "not sent",
  queued: "queued",
  read: "delivered",
  rejected: "not sent",
  routed: "in progress",
  scheduled: "in progress",
  sent: "in progress",
  suppressed: "not sent",
};

function ReminderPreferences({ confirmedOfferId, initial }) {
  const available = initial?.available === true;
  const [selected, setSelected] = useState(() => new Set(initial?.milestones ?? []));
  const [deliveryStates, setDeliveryStates] = useState(() => initial?.deliveryStates ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const updateSelection = (event) => {
    const milestone = event.currentTarget.value;
    setSelected((current) => {
      const next = new Set(current);
      if (event.currentTarget.checked) {
        next.add(milestone);
      } else {
        next.delete(milestone);
      }
      return next;
    });
    setError("");
    setStatus("");
  };

  const save = async (milestones = [...selected]) => {
    if (isSaving || (!available && milestones.length > 0)) {
      return;
    }
    setIsSaving(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch(
        `/api/account/reminder-preferences/${encodeURIComponent(confirmedOfferId)}`,
        {
          body: JSON.stringify({ milestones }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }
      );
      if (!response.ok) {
        throw new Error("Reminder choices could not be saved");
      }
      const payload = await response.json();
      if (Array.isArray(payload?.reminders?.deliveryStates)) {
        setDeliveryStates(payload.reminders.deliveryStates);
      }
      if (milestones.length === 0) {
        setSelected(new Set());
      }
      setStatus(
        milestones.length > 0
          ? "Journey reminder choices saved."
          : "Journey reminders are turned off for this journey."
      );
    } catch {
      setError("Reminder choices could not be saved. Your choices are still here; try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      aria-labelledby={`reminders-${confirmedOfferId}`}
      className="mt-5 border-[var(--account-border)] border-t pt-4"
    >
      <h4
        className="font-semibold text-[var(--account-ink)] text-sm"
        id={`reminders-${confirmedOfferId}`}
      >
        Journey reminders
      </h4>
      <p className="mt-2 text-[var(--account-muted)] text-xs leading-5">
        Choose milestones for this journey. Messages contain only a sign-in prompt—never journey,
        payment, or traveller details.
      </p>
      <p className="mt-2 text-[var(--account-muted)] text-xs leading-5">
        WhatsApp is requested first. RCS may be requested only after Sent confirms an unambiguous
        permanent WhatsApp failure. We do not send both together or use SMS.
      </p>
      {available ? (
        <p className="mt-2 text-[var(--account-muted)] text-xs">
          Verified phone: {initial?.maskedPhone}
        </p>
      ) : (
        <p className="mt-2 text-[#9b3d32] text-xs leading-5">
          A verified phone is required. A phone entered in your profile is not verification.
        </p>
      )}
      <fieldset className="mt-3 space-y-2" disabled={!available || isSaving}>
        <legend className="sr-only">Reminder milestones for this journey</legend>
        {REMINDER_MILESTONES.map(([value, label]) => (
          <label
            className="account-focus flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-[var(--account-ink)] text-sm has-disabled:cursor-not-allowed has-disabled:opacity-60"
            key={value}
          >
            <input
              checked={selected.has(value)}
              className="size-4 accent-[var(--account-gold)]"
              name={`reminder-${confirmedOfferId}`}
              onChange={updateSelection}
              type="checkbox"
              value={value}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <Button
        aria-busy={isSaving}
        className="mt-3 min-h-11 px-5 font-semibold text-sm"
        disabled={!available || isSaving}
        onClick={() => save()}
        surface="account"
        type="button"
      >
        {isSaving ? "Saving reminder choices…" : "Save reminder choices"}
      </Button>
      {!available && selected.size > 0 ? (
        <Button
          aria-busy={isSaving}
          className="mt-3 min-h-11 px-5 font-semibold text-sm"
          disabled={isSaving}
          onClick={() => save([])}
          surface="account"
          type="button"
        >
          {isSaving ? "Turning off journey reminders…" : "Turn off journey reminders"}
        </Button>
      ) : null}
      {deliveryStates.length > 0 ? (
        <section aria-labelledby={`reminder-delivery-${confirmedOfferId}`} className="mt-4">
          <h5
            className="font-semibold text-[var(--account-ink)] text-xs"
            id={`reminder-delivery-${confirmedOfferId}`}
          >
            Latest delivery state
          </h5>
          <ul className="mt-2 space-y-2 text-[var(--account-muted)] text-xs">
            {deliveryStates.map((delivery) => (
              <li key={`${delivery.milestone}-${delivery.channel}`}>
                <span>
                  {REMINDER_LABELS.get(delivery.milestone) ?? "Journey reminder"}:{" "}
                  {delivery.channel === "rcs" ? "RCS fallback" : "WhatsApp"}{" "}
                  {REMINDER_DELIVERY_COPY[delivery.status] ?? "status unavailable"}
                </span>
                <span className="ml-1">
                  · <Freshness at={delivery.updatedAt} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p
        aria-live="polite"
        className="mt-2 min-h-5 text-[var(--account-muted)] text-xs"
        role="status"
      >
        {status}
      </p>
      {error ? (
        <p className="mt-1 text-[#9b3d32] text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function ConfirmedTripPackets({ hasMore, isLoadingMore, loadError, onLoadMore, packets }) {
  if (!(packets.length || hasMore)) {
    return null;
  }
  return (
    <section aria-labelledby="confirmed-trip-packets-heading">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2
          className="account-display text-2xl text-[var(--account-ink)] sm:text-3xl"
          id="confirmed-trip-packets-heading"
        >
          Arrival Packs
        </h2>
        <span className="rounded-full bg-[var(--account-gold-soft)] px-3 py-1 font-semibold text-[var(--account-gold)] text-xs">
          Read-only travel record
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {packets.map((packet) => {
          const confirmationReady = packet.confirmation?.status === "confirmed";
          const travelReady = Boolean(
            Number.isFinite(packet.travel?.asOf) &&
              packet.travel?.destination &&
              packet.travel?.startDate &&
              packet.travel?.endDate
          );
          const stayReady = false;
          const destination = packet.travel?.destination || "Unknown destination";
          return (
            <article className="account-card min-w-0 rounded-2xl p-6" key={packet.confirmedOfferId}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[var(--account-muted)] text-xs">Confirmed journey record</p>
                  <h3 className="account-display mt-1 break-words text-2xl text-[var(--account-ink)]">
                    {destination}
                  </h3>
                  <p className="mt-1 text-[var(--account-muted)] text-xs">
                    {packet.entitlement?.role === "organizer"
                      ? "Organizer access"
                      : "Traveller access"}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--account-gold-soft)] px-3 py-1.5 font-semibold text-[var(--account-ink)] text-xs">
                  Read-only
                </span>
              </div>
              <dl className="mt-5 grid grid-cols-1 gap-4 border-[var(--account-border)] border-t pt-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[var(--account-muted)] text-xs">Travel dates</dt>
                  <dd className="mt-1 text-[var(--account-ink)]">
                    {formatAccountDateRange(packet.travel?.startDate, packet.travel?.endDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--account-muted)] text-xs">Record freshness</dt>
                  <dd className="mt-1 text-[var(--account-ink)]">
                    <Freshness at={packet.travel?.asOf} />
                  </dd>
                </div>
              </dl>
              <section
                aria-labelledby={`readiness-${packet.confirmedOfferId}`}
                className="mt-5 border-[var(--account-border)] border-t pt-4"
              >
                <h4
                  className="font-semibold text-[var(--account-ink)] text-sm"
                  id={`readiness-${packet.confirmedOfferId}`}
                >
                  Journey readiness
                </h4>
                <ol className="mt-3 space-y-3">
                  <ReadinessMilestone at={packet.confirmation?.at} ready={confirmationReady}>
                    Journey confirmation
                  </ReadinessMilestone>
                  <ReadinessMilestone at={packet.travel?.asOf} ready={travelReady}>
                    Confirmed travel summary
                  </ReadinessMilestone>
                  <ReadinessMilestone at={packet.staySummary?.asOf} ready={stayReady}>
                    Confirmed stay summary
                  </ReadinessMilestone>
                </ol>
              </section>
              <section
                aria-labelledby={`summary-${packet.confirmedOfferId}`}
                className="mt-5 border-[var(--account-border)] border-t pt-4"
              >
                <h4
                  className="font-semibold text-[var(--account-ink)] text-sm"
                  id={`summary-${packet.confirmedOfferId}`}
                >
                  Confirmed stay summary
                </h4>
                <p className="mt-3 whitespace-pre-wrap break-words text-[var(--account-muted)] text-sm leading-6">
                  Unknown — no approved confirmed stay summary is available.
                </p>
              </section>
              <ReminderPreferences
                confirmedOfferId={packet.confirmedOfferId}
                initial={packet.reminders}
              />
              <a
                className="account-focus mt-5 inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-[var(--account-night)] px-4 py-2 font-semibold text-[var(--account-night)] text-sm hover:bg-[var(--account-night)] hover:text-white"
                download
                href={`/api/account/arrival-pack/${encodeURIComponent(packet.confirmedOfferId)}`}
              >
                <Download aria-hidden="true" size={17} />
                <span className="break-words">{packet.nextAction?.label}</span>
              </a>
              <p className="mt-3 text-[var(--account-muted)] text-xs leading-5">
                The self-contained file works offline and can be printed or saved as a PDF. It will
                not update after download.
              </p>
            </article>
          );
        })}
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
  recovery,
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
      {recovery ? <JourneyRecoveryNotice /> : null}
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
            className="account-display text-2xl text-[var(--account-ink)] outline-none sm:text-3xl"
            id="upcoming-journey-heading"
            tabIndex={-1}
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
            <JourneyOverviewCard
              booking={primaryJourney}
              journeyKey={primaryJourney.journeyKey || primaryJourney.booking.id}
              onOpen={onOpenFirstBooking}
            />
            {upcomingBookings.length > 1 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {upcomingBookings.slice(1).map((booking) => (
                  <PastJourneyCard
                    booking={booking}
                    journeyKey={booking.journeyKey || booking.booking.id}
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
            text="When you book your next trip with Citius, its dates and itinerary will appear here."
            title="No upcoming trips"
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
                journeyKey={booking.journeyKey || booking.booking.id}
                key={booking.booking.id}
                onOpen={onOpenBooking}
              />
            ))}
          </div>
        ) : (
          <p className="border-[var(--account-border)] border-t py-5 text-[var(--account-muted)] text-sm">
            Completed trips appear here.
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
                journeyKey={booking.journeyKey || booking.booking.id}
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
  onJourneyClose,
  onJourneyOpen,
  onJourneyUnavailable,
  recovery = null,
  selectedJourneyKey,
}) {
  const [localJourneyKey, setLocalJourneyKey] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [detailRetry, setDetailRetry] = useState(0);
  const [loadedConfirmedTrips, setLoadedConfirmedTrips] = useState(() =>
    mergeConfirmedTripPackets([], confirmedTrips)
  );
  const confirmedTripCursor = useRef(confirmedTripsCursor);
  const [confirmedTripDone, setConfirmedTripDone] = useState(confirmedTripsDone);
  const [confirmedTripsLoading, setConfirmedTripsLoading] = useState(false);
  const [confirmedTripsLoadError, setConfirmedTripsLoadError] = useState("");
  const detailRequestId = useRef(0);
  const detailFocusRef = useRef(null);
  const pendingFocusRef = useRef(null);
  const controlled = selectedJourneyKey !== undefined;
  const activeJourneyKey = controlled ? selectedJourneyKey : localJourneyKey;
  const journeySummaries = [...upcomingBookings, ...pastBookings, ...cancelledBookings];
  const selectedSummary = journeySummaries.find(
    (summary) => (summary.journeyKey || summary.booking.id) === activeJourneyKey
  );

  const closeDetail = () => {
    detailRequestId.current += 1;
    setSelectedBooking(null);
    setDetailError("");
    if (controlled) {
      onJourneyClose?.();
    } else {
      setLocalJourneyKey(null);
    }
  };

  useEffect(() => {
    if (!activeJourneyKey) {
      detailRequestId.current += 1;
      setSelectedBooking(null);
      setDetailError("");
      return;
    }
    if (!selectedSummary) {
      detailRequestId.current += 1;
      if (controlled) {
        onJourneyUnavailable?.();
      } else {
        setLocalJourneyKey(null);
      }
      return;
    }
    const requestId = detailRequestId.current + detailRetry + 1;
    detailRequestId.current = requestId;
    setSelectedBooking(null);
    setDetailError("");
    const load = async () => {
      try {
        const detail = await loadJourneyDetail(activeJourneyKey, referenceNow);
        if (detailRequestId.current !== requestId) {
          return;
        }
        if (!detail) {
          if (controlled) {
            onJourneyUnavailable?.();
          } else {
            setLocalJourneyKey(null);
          }
          return;
        }
        setSelectedBooking(detail);
      } catch (error) {
        if (detailRequestId.current !== requestId) {
          return;
        }
        if (error?.code === "ACCOUNT_JOURNEY_UNAVAILABLE") {
          if (controlled) {
            onJourneyUnavailable?.();
          } else {
            setLocalJourneyKey(null);
          }
          return;
        }
        setDetailError("Journey details could not be loaded. Please try again.");
      }
    };
    load();
    return () => {
      if (detailRequestId.current === requestId) {
        detailRequestId.current += 1;
      }
    };
  }, [
    activeJourneyKey,
    controlled,
    detailRetry,
    loadJourneyDetail,
    onJourneyUnavailable,
    referenceNow,
    selectedSummary,
  ]);

  useEffect(() => {
    if (!activeJourneyKey) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      if (detailError && !selectedBooking) {
        pendingFocusRef.current?.focus({ preventScroll: true });
        return;
      }
      (selectedBooking ? detailFocusRef : pendingFocusRef).current?.focus({
        preventScroll: true,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeJourneyKey, detailError, selectedBooking]);

  const openJourney = (journeyKey) => {
    if (!journeyKey) {
      return;
    }
    if (controlled) {
      onJourneyOpen?.(journeyKey);
    } else {
      setLocalJourneyKey(journeyKey);
    }
  };
  const openFirstBooking = () => {
    const [first] = upcomingBookings;
    openJourney(first?.journeyKey || first?.booking.id);
  };
  const openBookingFromEvent = (event) => {
    const { accountJourneyKey } = event.currentTarget.dataset;
    if (accountJourneyKey) {
      openJourney(accountJourneyKey);
    }
  };
  const retryDetail = () => setDetailRetry((attempt) => attempt + 1);
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
      recovery={recovery}
      upcomingBookings={upcomingBookings}
    />
  );
  if (activeJourneyKey) {
    content = (
      <JourneyDetailPending
        error={detailError}
        focusRef={pendingFocusRef}
        key="journey-detail-pending"
        onBack={closeDetail}
        onRetry={retryDetail}
      />
    );
  }
  if (activeJourneyKey && selectedBooking) {
    content = (
      <JourneyDetail
        booking={selectedBooking}
        focusRef={detailFocusRef}
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
