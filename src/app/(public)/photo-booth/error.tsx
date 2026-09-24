"use client";

import { useState } from "react";
import type { BoothLanguage } from "@/lib/eventPhotoBooth/contracts";
import { boothCopy } from "@/lib/eventPhotoBooth/visitorCopy";

export default function PhotoBoothError({ reset }: { reset: () => void }) {
  const [language, setLanguage] = useState<BoothLanguage>("en");
  const copy = boothCopy(language);
  return (
    <section className="min-h-screen bg-public-paper px-6 py-20 text-public-ink" lang={language}>
      <div className="mx-auto max-w-lg space-y-6">
        <button
          className="min-h-11 underline"
          onClick={() => setLanguage(language === "en" ? "hi" : "en")}
          type="button"
        >
          English / हिन्दी
        </button>
        <h1 className="font-heading text-3xl">{copy.unavailable}</h1>
        <button
          className="min-h-11 rounded-lg bg-public-blue px-5 py-3 text-public-surface"
          onClick={reset}
          type="button"
        >
          {copy.retry}
        </button>
        <a className="block min-h-11 underline" href="/">
          {copy.explore}
        </a>
      </div>
    </section>
  );
}
