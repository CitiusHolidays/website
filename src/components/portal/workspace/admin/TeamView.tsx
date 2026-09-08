"use client";

import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import type { PortalTeamDirectoryRow, TeamViewProps } from "../portalViewTypes";

type TeamRow = PortalTeamDirectoryRow;

function renderTeamMember(row: TeamRow) {
  const details = [
    ["Mobile", row.mobile],
    ["Function", row.function],
    ["Location", row.location],
    ["Access", row.roles.join(", ")],
  ].filter(([, value]) => value);
  return (
    <div className="space-y-1 text-sm">
      <p className={row.isCurrentUser ? "font-semibold text-citius-blue" : "font-semibold"}>
        {row.name}
      </p>
      {row.department ? <p className="text-brand-muted">{row.department}</p> : null}
      {row.email ? <p className="break-words text-brand-muted">{row.email}</p> : null}
      {details.length > 0 ? (
        <details>
          <summary className="min-h-11 cursor-pointer py-3 font-medium text-citius-blue focus-visible:outline-2 focus-visible:outline-citius-blue">
            Contact and roles
          </summary>
          <dl className="space-y-2">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt className="text-brand-muted text-xs">{label}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </div>
  );
}

export function TeamView({ rows }: TeamViewProps) {
  return (
    <SelectableDataTable
      columns={[
        {
          id: "name",
          label: "Name",
          render: (row: TeamRow) => (
            <span
              className={row.isCurrentUser ? "font-semibold text-citius-blue" : "font-semibold"}
            >
              {row.name}
            </span>
          ),
          sortValue: (row: TeamRow) => row.name,
        },
        {
          id: "email",
          label: "Email",
          render: (row: TeamRow) => row.email,
          sortValue: (row: TeamRow) => row.email || "",
        },
        {
          id: "mobile",
          label: "Mobile",
          render: (row: TeamRow) => row.mobile || "-",
        },
        {
          id: "department",
          label: "Department",
          render: (row: TeamRow) => row.department || "-",
        },
        {
          id: "function",
          label: "Function",
          render: (row: TeamRow) => row.function || "-",
        },
        {
          id: "location",
          label: "Location",
          render: (row: TeamRow) => row.location || "-",
        },
        {
          id: "access",
          label: "Access",
          render: (row: TeamRow) => row.roles.join(", "),
        },
      ]}
      empty="No active staff records."
      mobileCardRender={renderTeamMember}
      rows={rows}
    />
  );
}
