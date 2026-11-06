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
  label = "Load more",
}: {
  status: string;
  loadMore: (count: number) => void;
  label?: string;
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
      {label}
    </Button>
  ) : null;
}

export function TravelViewSwitch<View extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: View) => void;
  options: readonly { label: string; value: View }[];
  value: View;
}) {
  return (
    <fieldset aria-label={label} className="flex items-center gap-5">
      {options.map((option) => (
        <Button
          aria-pressed={value === option.value}
          className={`min-h-11 rounded-none border-b-2 px-0 text-sm transition-colors ${value === option.value ? "border-citius-blue font-semibold text-citius-blue" : "border-transparent text-brand-muted hover:text-brand-dark"}`}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </Button>
      ))}
    </fieldset>
  );
}
