"use client";

import { Mail, Phone } from "lucide-react";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import type { PortalTeamDirectoryRow, TeamViewProps } from "../portalViewTypes";

type TeamRow = PortalTeamDirectoryRow;

const CONTACT_LINK =
  "inline-flex min-h-6 max-w-full items-center gap-1.5 text-citius-blue underline-offset-4 hover:underline focus-visible:underline";

function roleLabel(row: TeamRow) {
  return row.roles.join(", ");
}

/** Function falls back to the roles list on the server; showing that copy twice adds nothing. */
function functionLabel(row: TeamRow) {
  const value = row.function?.trim() ?? "";
  return value && value !== roleLabel(row) ? value : "-";
}

function telHref(mobile: string) {
  return `tel:${mobile.replace(/[^\d+]/g, "")}`;
}

function EmailLink({ row }: { row: TeamRow }) {
  if (!row.email) {
    return "-";
  }
  return (
    <a
      aria-label={`Email ${row.name} at ${row.email}`}
      className={`${CONTACT_LINK} whitespace-nowrap`}
      href={`mailto:${row.email}`}
    >
      {row.email}
    </a>
  );
}

function MobileLink({ row }: { row: TeamRow }) {
  if (!row.mobile) {
    return "-";
  }
  return (
    <a
      aria-label={`Call ${row.name} on ${row.mobile}`}
      className={`${CONTACT_LINK} whitespace-nowrap tabular-nums`}
      href={telHref(row.mobile)}
    >
      {row.mobile}
    </a>
  );
}

function PersonName({ row }: { row: TeamRow }) {
  return (
    <span
      className={`block font-semibold ${row.isCurrentUser ? "text-citius-blue" : "text-brand-dark"}`}
    >
      {row.name}
      {row.isCurrentUser ? <span className="font-normal text-brand-muted"> (you)</span> : null}
    </span>
  );
}

function NameAndRole({ row }: { row: TeamRow }) {
  return (
    <span className="block min-w-0">
      <PersonName row={row} />
      {row.roles.length > 0 ? (
        <span className="mt-0.5 block text-brand-muted text-xs">{roleLabel(row)}</span>
      ) : null}
    </span>
  );
}

function TeamMemberCard({ row }: { row: TeamRow }) {
  const details = [roleLabel(row), row.department, row.location].filter(Boolean).join(" · ");
  return (
    <article className="min-w-0">
      <PersonName row={row} />
      {details ? <p className="mt-0.5 text-brand-muted text-sm">{details}</p> : null}
      {row.email || row.mobile ? (
        <p className="mt-1 flex flex-wrap gap-x-5 text-sm">
          {row.mobile ? (
            <a
              aria-label={`Call ${row.name} on ${row.mobile}`}
              className={`${CONTACT_LINK} min-h-11 whitespace-nowrap tabular-nums`}
              href={telHref(row.mobile)}
            >
              <Phone aria-hidden className="shrink-0" size={14} />
              {row.mobile}
            </a>
          ) : null}
          {row.email ? (
            <a
              aria-label={`Email ${row.name} at ${row.email}`}
              className={`${CONTACT_LINK} min-h-11 min-w-0`}
              href={`mailto:${row.email}`}
            >
              <Mail aria-hidden className="shrink-0" size={14} />
              <span className="min-w-0 truncate">{row.email}</span>
            </a>
          ) : null}
        </p>
      ) : null}
    </article>
  );
}

const renderTeamMemberCard = (row: TeamRow) => <TeamMemberCard row={row} />;

export function TeamView({ rows }: TeamViewProps) {
  return (
    <SelectableDataTable
      columns={[
        {
          id: "name",
          kind: "identity",
          label: "Name and role",
          render: (row: TeamRow) => <NameAndRole row={row} />,
          sortValue: (row: TeamRow) => row.name,
        },
        {
          id: "department",
          label: "Department",
          render: (row: TeamRow) => row.department || "-",
          sortValue: (row: TeamRow) => row.department || "",
        },
        {
          id: "location",
          label: "Location",
          render: (row: TeamRow) => row.location || "-",
          sortValue: (row: TeamRow) => row.location || "",
        },
        {
          id: "email",
          label: "Email",
          render: (row: TeamRow) => <EmailLink row={row} />,
          sortValue: (row: TeamRow) => row.email || "",
        },
        {
          cellClassName: "whitespace-nowrap",
          id: "mobile",
          label: "Mobile",
          render: (row: TeamRow) => <MobileLink row={row} />,
        },
        {
          hideable: true,
          id: "function",
          label: "Function",
          mobile: "hidden",
          render: functionLabel,
          sortValue: (row: TeamRow) => functionLabel(row),
        },
      ]}
      empty="No active staff records."
      mobileCardRender={renderTeamMemberCard}
      rowLabel={(row: TeamRow) => row.name}
      rows={rows}
    />
  );
}
