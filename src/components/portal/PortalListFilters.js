"use client";

import { PortalSelectFilter } from "@/components/portal/PortalSelectFilter";
import { enrichFilterOptions, filterScopeRows } from "@/lib/portal/listFilters";

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

export function PortalListFilters({
  config = EMPTY_ARRAY,
  values = EMPTY_OBJECT,
  onChange,
  rows = EMPTY_ARRAY,
  view = "",
  jobCardFilter = "",
  search = "",
  searchKeys = EMPTY_ARRAY,
}) {
  if (!config.length) return null;

  const scopedRows = filterScopeRows(rows, { view, jobCardFilter, search, searchKeys });

  return (
    <div className="contents">
      {config.map((def) => {
        const baseOptions =
          def.options === "fromRows" && def.resolveOptions
            ? def.resolveOptions(scopedRows)
            : def.options || [];
        const options = enrichFilterOptions({
          options: baseOptions,
          rows: scopedRows,
          field: def.field,
          filterValues: values,
          config,
          filterFn: def.filterFn,
        });
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
    </div>
  );
}
