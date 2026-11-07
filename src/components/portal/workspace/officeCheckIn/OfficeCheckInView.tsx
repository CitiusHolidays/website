"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { DEFAULT_OFFICE_TIME_ZONE } from "@convex/crm/officeCheckInVerification";
import { useState } from "react";
import { isExactAdmin } from "@/components/portal/settings/operationalControlViewModel";
import { Button } from "@/components/ui/application-button";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { useTrackedQuery as useQuery } from "@/lib/portal/trackedConvexSubscriptions";
import { Panel } from "../portalWorkspaceListUi";
import { useActiveOperationReferenceNow } from "../usePortalReferenceClock";
import { MyDayPanel } from "./MyDayPanel";
import { OfficeSetupPanel } from "./OfficeSetupPanel";
import type { OfficeCheckInAccess, TeamDayRow } from "./officeCheckInTypes";
import { TeamDayPanel } from "./TeamDayPanel";
import { TeamRecordDialog, type TeamRecordDialogTarget } from "./TeamRecordDialogs";

/**
 * The status query takes a reference time so its "today" follows the office
 * day. Rounding it keeps the subscription arguments stable between ticks
 * instead of opening a new subscription every 30 seconds.
 */
const REFERENCE_QUANTUM_MS = 5 * 60 * 1000;

export interface OfficeCheckInViewProps {
  access: OfficeCheckInAccess | null | undefined;
  allowed: boolean;
  canFetch: boolean;
  has: (permission: string) => boolean;
}

function teamDayArgs(workDate: string, officeId: Id<"offices"> | null) {
  if (officeId) {
    return { officeId, workDate };
  }
  return { workDate };
}

type Section = "setup" | "today";

const SECTIONS: { label: string; value: Section }[] = [
  { label: "Today", value: "today" },
  { label: "Office setup", value: "setup" },
];

function useOfficeCheckInData(shouldFetch: boolean, wantsOverview: boolean) {
  const tick = useActiveOperationReferenceNow(shouldFetch);
  const referenceNow = Math.floor(tick / REFERENCE_QUANTUM_MS) * REFERENCE_QUANTUM_MS;
  const status = useQuery(api.crm.officeCheckIns.myStatus, shouldFetch ? { referenceNow } : "skip");
  const [chosenDate, setChosenDate] = useState<string | null>(null);
  const [officeFilter, setOfficeFilter] = useState<Id<"offices"> | null>(null);
  const workDate = chosenDate ?? status?.workDate ?? null;
  const teamArgs =
    shouldFetch && status?.canOversee && workDate ? teamDayArgs(workDate, officeFilter) : "skip";
  const team = useQuery(api.crm.officeCheckIns.teamDay, teamArgs);
  // The admin overview is only read while Office setup is open.
  const overview = useQuery(
    api.crm.officeCheckInAdmin.overview,
    shouldFetch && wantsOverview ? {} : "skip"
  );
  const changeDate = (value: string) => setChosenDate(value || null);
  const changeOffice = (value: string) =>
    setOfficeFilter(team?.offices.find((office) => office.id === value)?.id ?? null);
  return { changeDate, changeOffice, officeFilter, overview, status, team, workDate };
}

/** Today for everyone; Office setup only for people who can administer offices. */
function SectionSwitch({
  onChange,
  section,
}: {
  onChange: (section: Section) => void;
  section: Section;
}) {
  return (
    <fieldset
      aria-label="Office check-in section"
      className="flex items-center gap-6 border-brand-border border-b"
    >
      {SECTIONS.map((entry) => {
        const active = section === entry.value;
        const choose = () => onChange(entry.value);
        return (
          <Button
            aria-pressed={active}
            className={`-mb-px min-h-11 rounded-none border-b-2 px-0 text-sm ${active ? "border-citius-blue font-semibold text-citius-blue" : "border-transparent text-brand-muted hover:text-brand-dark"}`}
            key={entry.value}
            onClick={choose}
            type="button"
          >
            {entry.label}
          </Button>
        );
      })}
    </fieldset>
  );
}

type OfficeCheckInData = ReturnType<typeof useOfficeCheckInData>;

function canAdministerOffices(
  access: OfficeCheckInViewProps["access"],
  has: OfficeCheckInViewProps["has"]
) {
  return isExactAdmin(access ?? undefined) || has(P.MANAGE_STAFF);
}

/** Keeps an open dialog on the live row so a reactive update shows the current record. */
function liveDialogTarget(dialog: TeamRecordDialogTarget | null, team: OfficeCheckInData["team"]) {
  const liveRow = dialog && team?.rows.find((row) => row.staffId === dialog.row.staffId);
  return dialog && liveRow ? { ...dialog, row: liveRow } : dialog;
}

function OfficeTodaySection({
  data,
  onOpen,
  status,
}: {
  data: OfficeCheckInData;
  onOpen: (row: TeamDayRow) => void;
  status: NonNullable<OfficeCheckInData["status"]>;
}) {
  const { workDate } = data;
  return (
    <>
      <MyDayPanel status={status} />
      {status.canOversee && workDate ? (
        <TeamDayPanel
          officeId={data.officeFilter ?? ""}
          onOfficeChange={data.changeOffice}
          onOpen={onOpen}
          onWorkDateChange={data.changeDate}
          team={data.team}
          today={status.workDate}
          workDate={workDate}
        />
      ) : null}
    </>
  );
}

export function OfficeCheckInView({ access, allowed, canFetch, has }: OfficeCheckInViewProps) {
  const shouldFetch = allowed && canFetch;
  const canAdminister = canAdministerOffices(access, has);
  const [chosenSection, setSection] = useState<Section>("today");
  const section = canAdminister ? chosenSection : "today";
  const data = useOfficeCheckInData(shouldFetch, section === "setup");
  const [dialog, setDialog] = useState<TeamRecordDialogTarget | null>(null);
  const { status, team } = data;

  if (!shouldFetch) {
    return null;
  }
  if (!status) {
    return (
      <Panel title="My day">
        <p className="text-brand-muted text-sm" role="status">
          Loading your check-in…
        </p>
      </Panel>
    );
  }

  const openDialog = (row: TeamDayRow) => {
    if (team) {
      setDialog({ row, workDate: team.workDate });
    }
  };
  const closeDialog = () => setDialog(null);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      {canAdminister ? <SectionSwitch onChange={setSection} section={section} /> : null}
      {section === "setup" ? (
        <OfficeSetupPanel
          overview={data.overview}
          timeZone={status.timeZone || DEFAULT_OFFICE_TIME_ZONE}
        />
      ) : (
        <OfficeTodaySection data={data} onOpen={openDialog} status={status} />
      )}
      <TeamRecordDialog
        deletion={status.deletion}
        onClose={closeDialog}
        target={liveDialogTarget(dialog, team)}
      />
    </div>
  );
}
