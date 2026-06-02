"use client";

import { Users } from "lucide-react";

export default function FamilyComingSoon() {
  return (
    <div className="rounded-2xl border border-dashed border-brand-light bg-brand-light/30 px-5 py-6 text-center">
      <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-citius-blue/10">
        <Users className="size-5 text-citius-blue" />
      </div>
      <p className="font-heading text-lg text-brand-dark">Family progress</p>
      <p className="mt-2 font-sans text-sm text-brand-muted max-w-md mx-auto">
        Track household pilgrimage journeys together , coming soon. For now, build your personal
        digital legacy and compare with fellow yatris on the leaderboard.
      </p>
    </div>
  );
}
