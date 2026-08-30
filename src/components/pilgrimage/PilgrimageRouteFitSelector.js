"use client";

import { ArrowRight, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { getPublishedPilgrimageRouteFitOptions } from "@/data/trails";

export default function PilgrimageRouteFitSelector() {
  const options = getPublishedPilgrimageRouteFitOptions();
  const [selectedSlug, setSelectedSlug] = useState("");
  const selectedRoute = options.find((option) => option.slug === selectedSlug) ?? null;
  const selectRoute = (event) => setSelectedSlug(event.currentTarget.value);

  return (
    <section
      aria-labelledby="pilgrimage-route-fit-title"
      className="border-brand-light border-y bg-public-paper py-16 md:py-24"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <h2
            className="mb-4 font-heading text-3xl text-public-ink md:text-4xl"
            id="pilgrimage-route-fit-title"
          >
            Choose by time and route
          </h2>
          <p className="text-base text-public-muted leading-relaxed md:text-lg">
            Compare the two programmes with published itineraries. Select the duration and route you
            want to discuss; a specialist can help with questions before you make plans.
          </p>
        </div>

        <fieldset>
          <legend className="sr-only">Select a published Kailash programme</legend>
          <div className="grid gap-4 md:grid-cols-2">
            {options.map((option) => (
              <label className="block cursor-pointer" key={option.slug}>
                <input
                  checked={selectedSlug === option.slug}
                  className="peer sr-only"
                  name="pilgrimage-route-fit"
                  onChange={selectRoute}
                  type="radio"
                  value={option.slug}
                />
                <span className="flex min-h-44 flex-col rounded-2xl border border-brand-light bg-white p-6 shadow-sm transition-[border-color,box-shadow] peer-checked:border-citius-blue peer-checked:shadow-md peer-focus-visible:outline-2 peer-focus-visible:outline-citius-blue peer-focus-visible:outline-offset-4">
                  <span className="mb-4 font-heading text-citius-blue text-xl">{option.title}</span>
                  <span className="mb-2 text-brand-muted text-sm">
                    <strong className="font-semibold text-brand-dark">Duration:</strong>{" "}
                    {option.duration}
                  </span>
                  <span className="text-brand-muted text-sm leading-relaxed">
                    <strong className="font-semibold text-brand-dark">Route:</strong> {option.route}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div
          aria-live="polite"
          className="mt-6 rounded-2xl border border-citius-blue/15 bg-white p-6 md:p-8"
          role="status"
        >
          {selectedRoute ? (
            <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
              <div>
                <p className="font-heading text-citius-blue text-lg">{selectedRoute.title}</p>
                <p className="mt-1 text-public-muted text-sm">
                  Your enquiry will name this reviewed route, and you can edit every prefilled word
                  before sending.
                </p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Link
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-citius-blue px-5 py-2.5 font-medium text-citius-blue text-sm"
                  href={selectedRoute.detailHref}
                >
                  View route
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-citius-orange px-5 py-2.5 font-medium text-brand-dark text-sm"
                  href={selectedRoute.contactHref}
                >
                  Ask about this route
                  <MessageSquare className="size-4" />
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-center text-public-muted text-sm">
              Select either published route to review it or carry its name into an editable enquiry.
            </p>
          )}
        </div>

        <p className="mx-auto mt-5 max-w-3xl text-center text-public-muted text-xs leading-relaxed">
          This guide compares published programme facts only. It does not confirm medical
          suitability, availability, permits, or visa requirements.
        </p>
      </div>
    </section>
  );
}
