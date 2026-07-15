"use client";

export function EntityModalFieldSection({ children, columns = 2, description, eyebrow, title }) {
  return (
    <fieldset className="rounded-3xl border border-brand-border/80 bg-white p-4 shadow-[0_10px_32px_rgba(16,42,131,0.05)] sm:p-5 md:col-span-2">
      <legend className="px-1">
        <span className="block font-bold text-[length:var(--portal-label-size)] text-citius-orange-ink uppercase tracking-[0.14em]">
          {eyebrow}
        </span>
        <span className="mt-1 block font-heading font-semibold text-base text-brand-dark">
          {title}
        </span>
      </legend>
      {description ? (
        <p className="mb-4 text-brand-muted text-xs leading-relaxed">{description}</p>
      ) : null}
      <div className={columns === 1 ? "grid grid-cols-1 gap-4" : "grid gap-4 md:grid-cols-2"}>
        {children}
      </div>
    </fieldset>
  );
}
