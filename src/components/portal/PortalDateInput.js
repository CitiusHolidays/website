"use client";

import { Calendar } from "lucide-react";
import { useId, useState } from "react";
import {
  displayDateFromIsoDay,
  formatDisplayDateInputDigits,
  isoDayFromDisplayDate,
} from "@/lib/formatDate";

const BASE_CLASS =
  "h-11 w-full rounded-xl border bg-white px-3 pr-10 text-sm tabular-nums outline-none transition focus:ring-2 focus:ring-citius-blue/10";
const VALID_CLASS = `${BASE_CLASS} border-brand-border focus:border-citius-blue`;
const INVALID_CLASS = `${BASE_CLASS} border-red-300 focus:border-red-500`;
const NON_DIGIT_PATTERN = /\D/g;

/**
 * Date field that shows and accepts DD/MM/YYYY while storing ISO `YYYY-MM-DD`.
 */
export function PortalDateInput({
  value = "",
  onChange,
  className = "",
  inputClassName = "",
  placeholder = "DD/MM/YYYY",
  "aria-describedby": ariaDescribedBy = undefined,
  "aria-invalid": ariaInvalid = undefined,
  "aria-label": ariaLabel,
  id: idProp,
  required = false,
  disabled = false,
  name,
}) {
  const autoId = useId();
  const id = idProp || autoId;
  /** In-progress edit for the current `value`; null = show display from prop. */
  const [editState, setEditState] = useState(null);
  const [invalid, setInvalid] = useState(false);

  const propDisplay = displayDateFromIsoDay(value);
  const isEditing = editState !== null && editState.committedValue === value;
  const text = isEditing ? editState.draft : propDisplay;
  const showInvalid = invalid && isEditing;

  const beginEdit = (draft) => {
    setEditState({ committedValue: value, draft });
    setInvalid(false);
  };

  const commit = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange("");
      setEditState(null);
      setInvalid(false);
      return;
    }
    const iso = isoDayFromDisplayDate(trimmed);
    if (!iso) {
      setInvalid(true);
      return;
    }
    onChange(iso);
    setEditState(null);
    setInvalid(false);
  };
  const handleBlur = () => commit(text);
  const handleTextChange = (event) => {
    const next = formatDisplayDateInputDigits(event.target.value);
    beginEdit(next);
    const digits = next.replace(NON_DIGIT_PATTERN, "");
    if (digits.length === 8) {
      const iso = isoDayFromDisplayDate(next);
      if (iso) {
        onChange(iso);
        setEditState(null);
      }
    }
  };
  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit(text);
    }
  };
  const handleCalendarChange = (event) => {
    onChange(event.target.value);
    setEditState(null);
    setInvalid(false);
  };
  const showPicker = (event) => event.currentTarget.showPicker?.();

  return (
    <div className={`relative ${className}`.trim()}>
      <input
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid || showInvalid || undefined}
        aria-label={ariaLabel}
        autoComplete="off"
        className={`${showInvalid ? INVALID_CLASS : VALID_CLASS} ${inputClassName}`.trim()}
        disabled={disabled}
        id={id}
        inputMode="numeric"
        name={name}
        onBlur={handleBlur}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        type="text"
        value={text}
      />
      <Calendar
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-brand-muted"
      />
      <input
        aria-label={ariaLabel ? `${ariaLabel} calendar picker` : "Open calendar picker"}
        className="absolute top-1/2 right-1 h-9 w-9 -translate-y-1/2 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        disabled={disabled}
        onChange={handleCalendarChange}
        onClick={showPicker}
        tabIndex={-1}
        type="date"
        value={value || ""}
      />
    </div>
  );
}
