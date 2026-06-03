"use client";

import { PortalSelectFilter } from "@/components/portal/PortalSelectFilter";

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

export function PortalListFilters({
  config = EMPTY_ARRAY,
  values = EMPTY_OBJECT,
  onChange,
  rows = EMPTY_ARRAY,
}) {
  if (!config.length) return null;

  return (
    <>
      {config.map((def) => {
        const options =
          def.options === "fromRows" && def.resolveOptions
            ? def.resolveOptions(rows)
            : def.options || [];
        return (
          <PortalSelectFilter
            key={def.field}
            label={def.label}
            value={values[def.field] || ""}
            onChange={(next) => onChange(def.field, next)}
            options={options}
          />
        );
      })}
    </>
  );
}
