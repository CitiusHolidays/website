"use client";

import { useId, useState } from "react";
import {
  displayDateFromIsoDay,
  formatDisplayDateInputDigits,
  isoDayFromDisplayDate,
} from "@/lib/formatDate";

const BASE_CLASS =
  "h-11 rounded-xl border bg-white px-3 text-sm tabular-nums outline-none transition focus:ring-2 focus:ring-citius-blue/10";
const VALID_CLASS = `${BASE_CLASS} border-brand-border focus:border-citius-blue`;
const INVALID_CLASS = `${BASE_CLASS} border-red-300 focus:border-red-500`;

/**
 * Date field that shows and accepts DD/MM/YYYY while storing ISO `YYYY-MM-DD`.
 */
export function PortalDateInput({
  value = "",
  onChange,
  className = "",
  inputClassName = "",
  placeholder = "DD/MM/YYYY",
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

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      id={id}
      name={name}
      required={required}
      disabled={disabled}
      value={text}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-invalid={showInvalid || undefined}
      onChange={(event) => {
        const next = formatDisplayDateInputDigits(event.target.value);
        beginEdit(next);
        const digits = next.replace(/\D/g, "");
        if (digits.length === 8) {
          const iso = isoDayFromDisplayDate(next);
          if (iso) {
            onChange(iso);
            setEditState(null);
          }
        }
      }}
      onBlur={() => commit(text)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit(text);
        }
      }}
      className={`${showInvalid ? INVALID_CLASS : VALID_CLASS} ${inputClassName} ${className}`.trim()}
    />
  );
}
