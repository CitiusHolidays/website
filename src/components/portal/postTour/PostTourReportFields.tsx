"use client";

import { cloneElement, type ReactElement, type ReactNode, useId } from "react";
import { inputVariants, textareaVariants } from "@/components/ui/application-field-variants";

const fieldClass = inputVariants({ surface: "staff" });

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-1.5">
      <label className="block font-medium text-brand-dark text-sm" htmlFor={id}>
        {label}
      </label>
      {cloneElement(children, { id })}
    </div>
  );
}
export function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 border-brand-border border-t pt-6" data-report-section={number}>
      <h3 className="font-heading font-semibold text-brand-dark text-lg">
        <span className="mr-2 text-brand-muted">{number}.</span>
        {title}
      </h3>
      {children}
    </section>
  );
}
export function Choices({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <select
        className={`${fieldClass} bg-white`}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">Choose...</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function Comment({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <Field label={label}>
      <textarea
        className={`${textareaVariants({ surface: "staff" })} bg-white`}
        maxLength={4000}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        rows={3}
        value={value}
      />
    </Field>
  );
}
export function CheckList({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  const selectedOptions = new Set(selected);
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="mb-2 font-semibold text-brand-dark text-sm">{label}</legend>
      {options.map((option) => (
        <label className="flex min-h-11 items-center gap-2 text-sm" key={option}>
          <input
            checked={selectedOptions.has(option)}
            className="size-4 accent-citius-blue"
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...selected, option]
                  : selected.filter((value) => value !== option)
              )
            }
            type="checkbox"
          />
          {option}
        </label>
      ))}
    </fieldset>
  );
}
