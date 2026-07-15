"use client";

import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import type { PortalTeamDirectoryRow, TeamViewProps } from "../portalViewTypes";

type TeamRow = PortalTeamDirectoryRow;

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
      rows={rows}
    />
  );
}
