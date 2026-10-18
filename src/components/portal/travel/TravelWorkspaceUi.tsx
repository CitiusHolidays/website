"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/application-button";

export function TravelHeader({ title, children }: { title: string; children: ReactNode }) {
  return (
    <header className="grid overflow-hidden rounded-[28px] border border-[#0B1026]/10 bg-[#FDFBF7] sm:grid-cols-[1fr_28%]">
      <div className="flex flex-col justify-center px-6 py-7 sm:px-8 sm:py-8">
        <h1 className="font-heading font-semibold text-3xl text-[#0B1026] leading-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-brand-muted text-sm leading-relaxed">{children}</p>
      </div>
      <div className="relative h-20 sm:h-auto sm:min-h-44">
        <Image
          alt="Hillside homes above the coast in Positano"
          className="object-cover"
          fill
          priority
          sizes="(max-width:640px) 100vw, 320px"
          src="/gallery/account/amalfi-santorini/positano.webp"
        />
      </div>
    </header>
  );
}

export function MoreRows({
  status,
  loadMore,
}: {
  status: string;
  loadMore: (count: number) => void;
}) {
  const more = () => loadMore(30);
  return status === "CanLoadMore" || status === "LoadingMore" ? (
    <Button
      className="mt-4"
      disabled={status === "LoadingMore"}
      onClick={more}
      type="button"
      variant="outline"
    >
      Load more
    </Button>
  ) : null;
}
