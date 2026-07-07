"use client";

import { ChevronRight, Plane } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { ACCOUNT_CONTAINER_VARIANTS, ACCOUNT_ITEM_VARIANTS, BookingCard } from "./AccountUi";

export function AccountJourneysPanel({ upcomingBookings, pastBookings }) {
  return (
    <m.div
      animate="visible"
      className="space-y-12"
      exit={{ opacity: 0, y: 10 }}
      initial="hidden"
      key="journeys"
      variants={ACCOUNT_CONTAINER_VARIANTS}
    >
      <section>
        <m.h2
          className="mb-6 flex items-center gap-3 font-heading text-3xl text-[#0B1026]"
          variants={ACCOUNT_ITEM_VARIANTS}
        >
          Upcoming Journeys
          <span className="rounded-full bg-gray-100 px-2 py-1 font-normal font-sans text-gray-400 text-sm">
            {upcomingBookings.length}
          </span>
        </m.h2>

        {upcomingBookings.length > 0 ? (
          <div className="grid gap-6">
            {upcomingBookings.map((booking) => (
              <BookingCard booking={booking} key={booking.booking.id} type="upcoming" />
            ))}
          </div>
        ) : (
          <m.div
            className="rounded-2xl border border-gray-200 border-dashed bg-white p-12 text-center"
            variants={ACCOUNT_ITEM_VARIANTS}
          >
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-[#0B1026]/5 text-[#0B1026]">
              <Plane size={24} />
            </div>
            <h3 className="mb-2 font-heading text-[#0B1026] text-xl">No upcoming journeys</h3>
            <p className="mb-6 font-light text-gray-500">
              You haven&apos;t booked any trips yet. The world is waiting.
            </p>
            <Link
              className="inline-flex items-center gap-2 rounded-full bg-[#0B1026] px-6 py-3 text-white transition-colors hover:bg-[#1a2c4e]"
              href="/services"
            >
              Explore Destinations <ChevronRight size={16} />
            </Link>
          </m.div>
        )}
      </section>

      {pastBookings.length > 0 && (
        <section>
          <m.h2
            className="mt-12 mb-6 font-heading text-3xl text-[#0B1026] opacity-80"
            variants={ACCOUNT_ITEM_VARIANTS}
          >
            Past Memories
          </m.h2>
          <div className="grid gap-6 opacity-80 transition-opacity duration-300 hover:opacity-100">
            {pastBookings.map((booking) => (
              <BookingCard booking={booking} key={booking.booking.id} type="past" />
            ))}
          </div>
        </section>
      )}
    </m.div>
  );
}
