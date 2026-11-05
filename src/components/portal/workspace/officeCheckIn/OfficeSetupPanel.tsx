"use client";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { ChevronRight, Plus } from "lucide-react";
import { type ChangeEvent, type FormEvent, useId, useRef, useState } from "react";
import { usePortalToast } from "@/components/portal/PortalToast";
import { ControlledDialogClose, ControlledDialogTitle } from "@/components/ui/application-dialog";
import {
  describeOfficeCheck,
  ENFORCEMENT_LABELS,
  formatOfficeDateTime,
  formatWorkDate,
  NETWORK_REASON_SHORT,
} from "@/lib/officeCheckIn/presentation";
import { hasOwnKey } from "@/lib/runtimeValues";
import { formatConvexError } from "../portalWorkspaceListHelpers";
import { Panel } from "../portalWorkspaceListUi";
import {
  DialogBody,
  DialogFooter,
  FIELD_HINT,
  FIELD_LABEL,
  FieldError,
  OfficeDialog,
  ToneBadge,
} from "./OfficeCheckInParts";
import { OfficeSettingsDialog } from "./OfficeSettingsDialog";
import { OfficeStaffDialog } from "./OfficeStaffDialog";
import type { OfficeCheckInOverview, OverviewOffice } from "./officeCheckInTypes";

const OFFICE_CODE_PATTERN = /^[A-Z0-9-]{2,12}$/;
const INPUT = "portal-input text-base sm:text-sm";

function OfficeCard({
  office,
  onEdit,
  onStaff,
}: {
  office: OverviewOffice;
  onEdit: (id: string) => void;
  onStaff: (id: string) => void;
}) {
  const nameId = useId();
  const edit = () => onEdit(office.id);
  const staff = () => onStaff(office.id);
  const mode = office.rule ? ENFORCEMENT_LABELS[office.rule.enforcementMode] : null;
  return (
    <li className="grid content-between gap-4 rounded-xl border border-brand-border/80 bg-white p-4">
      <div className="grid gap-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 break-words font-semibold text-brand-dark text-sm" id={nameId}>
            {office.name}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {office.active ? null : <ToneBadge label="Inactive" tone="gray" />}
            {mode ? (
              <ToneBadge
                label={mode}
                tone={office.rule?.enforcementMode === "enforce" ? "blue" : "gray"}
              />
            ) : (
              <ToneBadge label="Not set up" tone="amber" />
            )}
          </div>
        </div>
        <p className="text-brand-muted text-xs">
          {[office.code, office.city].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-1 text-brand-dark text-sm">
          {describeOfficeCheck(office.rule?.requirement ?? "not_configured")}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          aria-describedby={nameId}
          className="portal-small-btn tabular-nums"
          onClick={staff}
          type="button"
        >
          Staff ({office.assignedStaff})
        </button>
        <button
          aria-label={`Edit ${office.name}`}
          className="portal-small-btn"
          onClick={edit}
          type="button"
        >
          Edit
        </button>
      </div>
    </li>
  );
}

function AddOfficeForm({
  onBusyChange,
  onCreated,
}: {
  onBusyChange: (busy: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const toast = usePortalToast();
  const createOffice = useMutation(api.crm.officeCheckInAdmin.createOffice);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [city, setCity] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const id = useId();
  const nameRef = useRef<HTMLInputElement | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) {
      return;
    }
    const normalizedCode = code.trim().toUpperCase();
    if (name.trim().length < 2 || !OFFICE_CODE_PATTERN.test(normalizedCode)) {
      setProblem("Enter a name and a short code of 2–12 letters, digits or dashes.");
      nameRef.current?.focus();
      return;
    }
    setProblem(null);
    setSaving(true);
    onBusyChange(true);
    try {
      const officeId = await createOffice({
        city: city.trim() || undefined,
        code: normalizedCode,
        name: name.trim(),
      });
      toast.success(`${name.trim()} added. Now choose what it checks.`);
      onCreated(officeId);
    } catch (error) {
      setProblem(formatConvexError(error, "Couldn't add the office. Try again."));
    }
    setSaving(false);
    onBusyChange(false);
  };
  const onText = (setter: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) =>
    setter(event.currentTarget.value);

  return (
    <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={submit}>
      <DialogBody>
        <ControlledDialogTitle className="font-heading font-semibold text-citius-blue text-lg">
          Add an office
        </ControlledDialogTitle>
        <div className="mt-5 grid gap-4">
          <div className="grid gap-1.5">
            <label className={FIELD_LABEL} htmlFor={`${id}-name`}>
              Name
            </label>
            <input
              aria-describedby={problem ? `${id}-problem` : undefined}
              aria-invalid={problem ? true : undefined}
              className={INPUT}
              id={`${id}-name`}
              onChange={onText(setName)}
              placeholder="Thane office"
              ref={nameRef}
              value={name}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid content-start gap-1.5">
              <label className={FIELD_LABEL} htmlFor={`${id}-code`}>
                Short code
              </label>
              <input
                aria-describedby={`${id}-code-hint`}
                autoCapitalize="characters"
                className={`${INPUT} font-mono uppercase`}
                id={`${id}-code`}
                maxLength={12}
                onChange={onText(setCode)}
                placeholder="THN"
                spellCheck={false}
                value={code}
              />
              <p className={FIELD_HINT} id={`${id}-code-hint`}>
                Shown in the history.
              </p>
            </div>
            <div className="grid content-start gap-1.5">
              <label className={FIELD_LABEL} htmlFor={`${id}-city`}>
                City <span className="font-normal text-brand-muted">(optional)</span>
              </label>
              <input className={INPUT} id={`${id}-city`} onChange={onText(setCity)} value={city} />
            </div>
          </div>
          <FieldError id={`${id}-problem`} message={problem} />
        </div>
      </DialogBody>
      <DialogFooter>
        <ControlledDialogClose className="portal-outline-btn" disabled={saving} type="button">
          Cancel
        </ControlledDialogClose>
        <button
          aria-busy={saving || undefined}
          className="portal-primary-btn"
          disabled={saving}
          type="submit"
        >
          {saving ? "Adding…" : "Add office"}
        </button>
      </DialogFooter>
    </form>
  );
}

function AddOfficeDialog({
  onClose,
  onCreated,
  open,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
  open: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <OfficeDialog busy={busy} onClose={onClose} open={open}>
      {open ? <AddOfficeForm onBusyChange={setBusy} onCreated={onCreated} /> : null}
    </OfficeDialog>
  );
}

function RecentChanges({
  overview,
  timeZone,
}: {
  overview: OfficeCheckInOverview;
  timeZone: string;
}) {
  if (overview.recentAudit.length === 0) {
    return <p className="text-brand-muted text-sm">No changes recorded yet.</p>;
  }
  return (
    <ul className="divide-y divide-brand-border/60">
      {overview.recentAudit.map((event) => (
        <li className="grid gap-0.5 py-2.5 text-sm" key={event.id}>
          <span className="text-brand-dark">
            <span className="text-brand-muted tabular-nums">
              {formatOfficeDateTime(event.at, timeZone)}
            </span>{" "}
            · {event.actorName}: {event.summary}
          </span>
          {event.reason ? (
            <span className="text-brand-muted text-xs">Reason: {event.reason}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function shortReasons(reasons: readonly string[]) {
  return reasons
    .map((reason) =>
      hasOwnKey(NETWORK_REASON_SHORT, reason) ? NETWORK_REASON_SHORT[reason] : reason
    )
    .join(", ");
}

function UnmatchedNetworks({ overview }: { overview: OfficeCheckInOverview }) {
  const officeNames = new Map<string, string>(
    overview.offices.map((office) => [office.id, office.name])
  );
  if (overview.unmatchedNetworks.length === 0) {
    return <p className="text-brand-muted text-sm">None yet. They appear after people check in.</p>;
  }
  return (
    <ul className="divide-y divide-brand-border/60">
      {overview.unmatchedNetworks.map((entry) => (
        <li className="grid gap-0.5 py-2.5 text-sm" key={`${entry.officeId}|${entry.prefix}`}>
          <span className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="break-all font-mono text-brand-dark text-xs">{entry.prefix}</span>
            <span className="text-brand-muted text-xs tabular-nums">
              Seen {entry.count} {entry.count === 1 ? "time" : "times"}, last{" "}
              {formatWorkDate(entry.lastWorkDate)}
            </span>
          </span>
          <span className="text-brand-muted text-xs">
            {officeNames.get(entry.officeId) ?? "Unknown office"} · {shortReasons(entry.reasons)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function HistorySection({
  overview,
  timeZone,
}: {
  overview: OfficeCheckInOverview;
  timeZone: string;
}) {
  return (
    <details className="group rounded-2xl border border-brand-border/70 bg-white/95 px-4 py-2 md:px-5">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 font-heading font-semibold text-brand-dark text-sm [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden="true"
          className="size-4 text-brand-muted transition-transform group-open:rotate-90"
        />
        History and pilot networks
      </summary>
      <div className="grid gap-6 pt-2 pb-3 lg:grid-cols-2">
        <section aria-labelledby="office-setup-history" className="min-w-0">
          <h3 className={FIELD_LABEL} id="office-setup-history">
            Recent changes
          </h3>
          <p className={FIELD_HINT}>The latest 25 changes. Times in {timeZone}.</p>
          <div className="mt-2">
            <RecentChanges overview={overview} timeZone={timeZone} />
          </div>
        </section>
        <section aria-labelledby="office-setup-networks" className="min-w-0">
          <h3 className={FIELD_LABEL} id="office-setup-networks">
            Unmatched networks seen during the pilot
          </h3>
          <p className={FIELD_HINT}>
            Internet addresses people checked in from that didn't match their office. Use them with
            IT to find each office's real address. An address alone doesn't prove where someone was.
          </p>
          <div className="mt-2">
            <UnmatchedNetworks overview={overview} />
          </div>
        </section>
      </div>
    </details>
  );
}

/** Office setup: each office as a card, with its settings and staff behind one dialog each. */
export function OfficeSetupPanel({
  overview,
  timeZone,
}: {
  overview: OfficeCheckInOverview | undefined;
  timeZone: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  if (!overview) {
    return (
      <Panel title="Offices">
        <p className="text-brand-muted text-sm" role="status">
          Loading offices…
        </p>
      </Panel>
    );
  }
  const find = (id: string | null) => overview.offices.find((office) => office.id === id) ?? null;
  const openAdd = () => setAdding(true);
  const closeAdd = () => setAdding(false);
  const created = (id: string) => {
    setAdding(false);
    setEditingId(id);
  };
  const closeEdit = () => setEditingId(null);
  const closeStaff = () => setStaffId(null);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <Panel
        action={
          <button className="portal-small-btn shrink-0" onClick={openAdd} type="button">
            <Plus aria-hidden="true" className="size-3.5" />
            Add office
          </button>
        }
        subtitle="What each office checks when people clock in, and who works there."
        title="Offices"
      >
        {overview.offices.length === 0 ? (
          <p className="rounded-xl border border-brand-border border-dashed px-3 py-3 text-brand-muted text-sm">
            No offices yet. Add the first office, then choose what it checks.
          </p>
        ) : (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-3">
            {overview.offices.map((office) => (
              <OfficeCard
                key={office.id}
                office={office}
                onEdit={setEditingId}
                onStaff={setStaffId}
              />
            ))}
          </ul>
        )}
      </Panel>
      <HistorySection overview={overview} timeZone={timeZone} />
      <AddOfficeDialog onClose={closeAdd} onCreated={created} open={adding} />
      <OfficeSettingsDialog office={find(editingId)} onClose={closeEdit} />
      <OfficeStaffDialog office={find(staffId)} onClose={closeStaff} overview={overview} />
    </div>
  );
}
