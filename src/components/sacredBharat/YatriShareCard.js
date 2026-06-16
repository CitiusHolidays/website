"use client";

import { Share2 } from "lucide-react";

export default function YatriShareCard({ text, url }) {
  const copy = async () => {
    if (navigator?.clipboard) {
      await navigator.clipboard.writeText(`${text} ${url}`);
    }
  };
  return (
    <div className="rounded-lg border border-brand-light bg-white p-4">
      <div className="flex items-center gap-2">
        <Share2 className="size-4 text-citius-blue" />
        <p className="font-heading text-sm text-brand-dark">Share passport</p>
      </div>
      <p className="mt-2 font-sans text-sm text-brand-muted">{text}</p>
      <button
        type="button"
        onClick={copy}
        className="mt-4 rounded-md bg-citius-blue px-3 py-2 font-sans text-xs font-semibold text-white"
      >
        Copy share text
      </button>
    </div>
  );
}
