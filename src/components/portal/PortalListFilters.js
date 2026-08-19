"use client";

import { useCallback } from "react";
import { PortalSelectFilter } from "@/components/portal/PortalSelectFilter";
import { enrichFilterOptions, filterScopeRows } from "@/lib/portal/listFilters";

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

function ListFilterControl({ def, onChange, options, value }) {
  const handleChange = useCallback((next) => onChange(def.field, next), [def.field, onChange]);
  return (
    <PortalSelectFilter label={def.label} onChange={handleChange} options={options} value={value} />
  );
}

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
  if (!config.length) {
    return null;
  }

  const scopedRows = filterScopeRows(rows, { jobCardFilter, search, searchKeys, view });

  return (
    <div className="contents">
      {config.map((def) => {
        const baseOptions =
          def.options === "fromRows" && def.resolveOptions
            ? def.resolveOptions(scopedRows)
            : def.options || [];
        const options = enrichFilterOptions({
          config,
          field: def.field,
          filterFn: def.filterFn,
          filterValues: values,
          options: baseOptions,
          rows: scopedRows,
        });
        return (
          <ListFilterControl
            def={def}
            key={def.field}
            onChange={onChange}
            options={options}
            value={values[def.field] || ""}
          />
        );
      })}
    </div>
  );
}
