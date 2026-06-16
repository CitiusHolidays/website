"use client";

import { m } from "motion/react";
import { ChevronRight, Plane } from "lucide-react";
import Link from "next/link";
import { ACCOUNT_CONTAINER_VARIANTS, ACCOUNT_ITEM_VARIANTS, BookingCard } from "./AccountUi";

export function AccountJourneysPanel({ upcomingBookings, pastBookings }) {
  return (
    <m.div
      key="journeys"
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, y: 10 }}
      variants={ACCOUNT_CONTAINER_VARIANTS}
      className="space-y-12"
    >
      <section>
        <m.h2
          variants={ACCOUNT_ITEM_VARIANTS}
          className="font-heading text-3xl text-[#0B1026] mb-6 flex items-center gap-3"
        >
          Upcoming Journeys
          <span className="text-sm font-sans font-normal text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
            {upcomingBookings.length}
          </span>
        </m.h2>

        {upcomingBookings.length > 0 ? (
          <div className="grid gap-6">
            {upcomingBookings.map((booking) => (
              <BookingCard key={booking.booking.id} booking={booking} type="upcoming" />
            ))}
          </div>
        ) : (
          <m.div
            variants={ACCOUNT_ITEM_VARIANTS}
            className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-200"
          >
            <div className="size-16 bg-[#0B1026]/5 rounded-full flex items-center justify-center mx-auto mb-4 text-[#0B1026]">
              <Plane size={24} />
            </div>
            <h3 className="font-heading text-xl text-[#0B1026] mb-2">No upcoming journeys</h3>
            <p className="text-gray-500 font-light mb-6">
              You haven&apos;t booked any trips yet. The world is waiting.
            </p>
            <Link
              href="/services"
              className="inline-flex items-center gap-2 bg-[#0B1026] text-white px-6 py-3 rounded-full hover:bg-[#1a2c4e] transition-colors"
            >
              Explore Destinations <ChevronRight size={16} />
            </Link>
          </m.div>
        )}
      </section>

      {pastBookings.length > 0 && (
        <section>
          <m.h2
            variants={ACCOUNT_ITEM_VARIANTS}
            className="font-heading text-3xl text-[#0B1026] mb-6 mt-12 opacity-80"
          >
            Past Memories
          </m.h2>
          <div className="grid gap-6 opacity-80 hover:opacity-100 transition-opacity duration-300">
            {pastBookings.map((booking) => (
              <BookingCard key={booking.booking.id} booking={booking} type="past" />
            ))}
          </div>
        </section>
      )}
    </m.div>
  );
}
