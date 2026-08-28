"use client";

export function EntityModalFieldSection({ children, columns = 2, description, title }) {
  return (
    <fieldset className="border-brand-border/80 border-b pb-6 last:border-b-0 last:pb-0 md:col-span-2">
      <legend className="font-heading font-semibold text-brand-dark text-lg">{title}</legend>
      {description ? (
        <p className="mt-1 mb-4 max-w-3xl text-brand-muted text-sm leading-relaxed">
          {description}
        </p>
      ) : null}
      <div className={columns === 1 ? "grid grid-cols-1 gap-4" : "grid gap-4 md:grid-cols-2"}>
        {children}
      </div>
    </fieldset>
  );
}
