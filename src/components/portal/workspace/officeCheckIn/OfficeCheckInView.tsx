"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { DEFAULT_OFFICE_TIME_ZONE } from "@convex/crm/officeCheckInVerification";
import { useState } from "react";
import { isExactAdmin } from "@/components/portal/settings/operationalControlViewModel";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { useTrackedQuery as useQuery } from "@/lib/portal/trackedConvexSubscriptions";
import { Panel } from "../portalWorkspaceListUi";
import { useActiveOperationReferenceNow } from "../usePortalReferenceClock";
import { MyDayPanel } from "./MyDayPanel";
import { OfficeRulesAdmin } from "./OfficeRulesAdmin";
import type { OfficeCheckInAccess, TeamDayRow } from "./officeCheckInTypes";
import { TeamDayPanel } from "./TeamDayPanel";
import {
  TeamRecordDialog,
  type TeamRecordDialogKind,
  type TeamRecordDialogTarget,
} from "./TeamRecordDialogs";

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

function useOfficeCheckInData(shouldFetch: boolean, canAdminister: boolean) {
  const tick = useActiveOperationReferenceNow(shouldFetch);
  const referenceNow = Math.floor(tick / REFERENCE_QUANTUM_MS) * REFERENCE_QUANTUM_MS;
  const status = useQuery(api.crm.officeCheckIns.myStatus, shouldFetch ? { referenceNow } : "skip");
  const [chosenDate, setChosenDate] = useState<string | null>(null);
  const [officeFilter, setOfficeFilter] = useState<Id<"offices"> | null>(null);
  const workDate = chosenDate ?? status?.workDate ?? null;
  const teamArgs =
    shouldFetch && status?.canOversee && workDate ? teamDayArgs(workDate, officeFilter) : "skip";
  const team = useQuery(api.crm.officeCheckIns.teamDay, teamArgs);
  const overview = useQuery(
    api.crm.officeCheckInAdmin.overview,
    shouldFetch && canAdminister ? {} : "skip"
  );
  const changeDate = (value: string) => setChosenDate(value || null);
  const changeOffice = (value: string) =>
    setOfficeFilter(team?.offices.find((office) => office.id === value)?.id ?? null);
  return { changeDate, changeOffice, officeFilter, overview, status, team, workDate };
}

export function OfficeCheckInView({ access, allowed, canFetch, has }: OfficeCheckInViewProps) {
  const shouldFetch = allowed && canFetch;
  const canAdminister = isExactAdmin(access ?? undefined) || has(P.MANAGE_STAFF);
  const data = useOfficeCheckInData(shouldFetch, canAdminister);
  const [dialog, setDialog] = useState<TeamRecordDialogTarget | null>(null);
  const { status, team, workDate } = data;

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

  const fallbackTimeZone = status.timeZone || DEFAULT_OFFICE_TIME_ZONE;
  const showTeam = status.canOversee;
  const openDialog = (kind: TeamRecordDialogKind, row: TeamDayRow) => {
    if (team) {
      setDialog({ kind, row, timeZone: row.timeZone, workDate: team.workDate });
    }
  };
  const closeDialog = () => setDialog(null);
  // Keep an open dialog on the live row so a reactive update shows the current record.
  const liveRow = dialog && team?.rows.find((row) => row.staffId === dialog.row.staffId);
  const liveDialog = dialog && liveRow ? { ...dialog, row: liveRow } : dialog;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <MyDayPanel status={status} />
      {showTeam && workDate ? (
        <TeamDayPanel
          officeId={data.officeFilter ?? ""}
          onOfficeChange={data.changeOffice}
          onOpenDialog={openDialog}
          onWorkDateChange={data.changeDate}
          team={team}
          workDate={workDate}
        />
      ) : null}
      {canAdminister ? (
        <OfficeRulesAdmin overview={data.overview} timeZone={fallbackTimeZone} />
      ) : null}
      <TeamRecordDialog onClose={closeDialog} target={liveDialog} />
    </div>
  );
}
