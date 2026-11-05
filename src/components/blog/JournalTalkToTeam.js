import PublicContactCta from "@/components/ui/PublicContactCta";

/** The Journal's closing handoff: one band, one action, the site's existing contact control. */
export default function JournalTalkToTeam({ heading = "Planning a journey like this?" }) {
  return (
    <section aria-labelledby="journal-talk-heading" className="bg-public-night text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-20 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end lg:px-8 lg:py-28">
        <div>
          <h2
            className="font-(family-name:--font-journal) max-w-[20ch] text-balance font-medium text-4xl leading-[1.05] tracking-[-0.01em] sm:text-5xl"
            id="journal-talk-heading"
          >
            {heading}
          </h2>
          <p className="mt-5 max-w-[48ch] text-pretty text-lg text-white/80 leading-relaxed">
            Pilgrimages, group tours and company events, planned from our offices in Mumbai,
            Bengaluru and Kolkata. Tell us who is travelling and when.
          </p>
        </div>
        <PublicContactCta href="/contact">Talk to the team</PublicContactCta>
      </div>
    </section>
  );
}
