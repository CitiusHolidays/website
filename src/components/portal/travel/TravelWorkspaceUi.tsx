"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/application-button";

export function TravelHeader({ title, children }: { title: string; children: ReactNode }) {
  return (
    <header className="border-brand-border border-b pb-5">
      <h1 className="portal-page-title font-heading font-semibold text-brand-dark">{title}</h1>
      <p className="mt-2 max-w-2xl text-brand-muted text-sm leading-relaxed">{children}</p>
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
