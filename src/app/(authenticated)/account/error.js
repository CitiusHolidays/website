"use client";

import { useEffect } from "react";
import { AccountStateCard } from "@/components/account/AccountUi";

export default function AccountError({ reset }) {
  useEffect(() => {
    console.error("Customer Account route failed to render.");
  }, []);

  return (
    <main className="min-h-dvh bg-brand-light px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <AccountStateCard
          action={
            <button
              className="inline-flex min-h-11 items-center rounded-full bg-brand-dark px-5 py-2.5 font-semibold text-sm text-white transition-[background-color,transform] duration-150 fine-hover:hover:-translate-y-px hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-citius-orange focus-visible:outline-offset-2"
              onClick={reset}
              type="button"
            >
              Try again
            </button>
          }
          description="We could not load your Account right now. Please try again, or return to the Citius website if the problem continues."
          title="Your Account could not load"
          tone="danger"
        />
      </div>
    </main>
  );
}
