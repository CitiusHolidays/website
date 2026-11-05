"use client";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { ShieldCheck } from "lucide-react";
import { type ChangeEvent, type FormEvent, useId, useRef, useState } from "react";
import { usePortalToast } from "@/components/portal/PortalToast";
import { Select } from "@/components/ui/application-select";
import {
  ENFORCEMENT_LABELS,
  formatOfficeDateTime,
  formatWorkDate,
  NETWORK_REASON_SHORT,
  REQUIREMENT_LABELS,
  reasonProblem,
} from "@/lib/officeCheckIn/presentation";
import { hasOwnKey } from "@/lib/runtimeValues";
import { formatConvexError } from "../portalWorkspaceListHelpers";
import { Panel } from "../portalWorkspaceListUi";
import { FieldError, ReasonField } from "./OfficeCheckInParts";
import { OfficeRuleEditor } from "./OfficeRuleEditor";
import type { OfficeCheckInOverview, OverviewOffice } from "./officeCheckInTypes";

const LABEL = "font-medium text-brand-dark text-sm";
const HINT = "text-brand-muted text-xs";
const OFFICE_CODE_PATTERN = /^[A-Z0-9-]{2,12}$/;

function ruleSummary(office: OverviewOffice) {
  if (!office.rule) {
    return "No rule yet";
  }
  return `${REQUIREMENT_LABELS[office.rule.requirement]} · ${ENFORCEMENT_LABELS[office.rule.enforcementMode]}`;
}

function OfficeList({
  offices,
  onSelect,
  selectedId,
}: {
  offices: OverviewOffice[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  if (offices.length === 0) {
    return (
      <p className="rounded-xl border border-brand-border border-dashed px-3 py-3 text-brand-muted text-sm">
        No offices yet. Add the first office below, then set its rule.
      </p>
    );
  }
  return (
    <ul aria-label="Offices" className="grid grid-cols-[minmax(0,1fr)] gap-1">
      {offices.map((office) => {
        const selected = office.id === selectedId;
        const select = () => onSelect(office.id);
        return (
          <li key={office.id}>
            <button
              aria-current={selected ? "true" : undefined}
              className={`w-full rounded-xl border px-3 py-2.5 text-start transition-colors ${
                // White fill keeps the grey meta text at 4.5:1; the border and
                // aria-current carry the selection.
                selected
                  ? "border-citius-blue/60 bg-white shadow-sm"
                  : "border-transparent hover:border-brand-border"
              }`}
              onClick={select}
              type="button"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate font-semibold text-brand-dark text-sm">
                  {office.name}
                </span>
                <span className="shrink-0 font-mono text-brand-muted text-xs">{office.code}</span>
              </span>
              <span className="mt-0.5 block text-brand-muted text-xs">
                {[office.city, `${office.assignedStaff} staff`, office.active ? null : "Inactive"]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span className="mt-0.5 block text-brand-dark text-xs">{ruleSummary(office)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CreateOfficeForm({ onCreated }: { onCreated: (id: string) => void }) {
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
      setProblem("Enter a name and a 2–12 character code using letters, digits or dashes.");
      nameRef.current?.focus();
      return;
    }
    setProblem(null);
    setSaving(true);
    try {
      const officeId = await createOffice({
        city: city.trim() || undefined,
        code: normalizedCode,
        name: name.trim(),
      });
      toast.success(`${name.trim()} added.`);
      setName("");
      setCode("");
      setCity("");
      onCreated(officeId);
    } catch (error) {
      setProblem(formatConvexError(error, "Couldn't add the office. Try again."));
    }
    setSaving(false);
  };
  const onText = (setter: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) =>
    setter(event.currentTarget.value);

  return (
    <form
      aria-labelledby={`${id}-title`}
      className="grid gap-3 border-brand-border/70 border-t pt-4"
      noValidate
      onSubmit={submit}
    >
      <h3 className="font-medium text-brand-dark text-sm" id={`${id}-title`}>
        Add an office
      </h3>
      <div className="grid gap-1.5">
        <label className={LABEL} htmlFor={`${id}-name`}>
          Name
        </label>
        <input
          aria-describedby={problem ? `${id}-problem` : undefined}
          aria-invalid={problem ? true : undefined}
          className="portal-input"
          id={`${id}-name`}
          onChange={onText(setName)}
          placeholder="Branch name"
          ref={nameRef}
          value={name}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <label className={LABEL} htmlFor={`${id}-code`}>
            Code
          </label>
          <input
            autoCapitalize="characters"
            className="portal-input font-mono uppercase"
            id={`${id}-code`}
            maxLength={12}
            onChange={onText(setCode)}
            placeholder="BR-01"
            spellCheck={false}
            value={code}
          />
        </div>
        <div className="grid gap-1.5">
          <label className={LABEL} htmlFor={`${id}-city`}>
            City <span className="font-normal text-brand-muted">(optional)</span>
          </label>
          <input
            className="portal-input"
            id={`${id}-city`}
            onChange={onText(setCity)}
            value={city}
          />
        </div>
      </div>
      <FieldError id={`${id}-problem`} message={problem} />
      <div>
        <button
          aria-busy={saving || undefined}
          className="portal-small-btn"
          disabled={saving}
          type="submit"
        >
          {saving ? "Adding…" : "Add office"}
        </button>
      </div>
    </form>
  );
}

function StaffAssignment({ overview }: { overview: OfficeCheckInOverview }) {
  const toast = usePortalToast();
  const assign = useMutation(api.crm.officeCheckInAdmin.assignStaffOffice);
  const [staffId, setStaffId] = useState("");
  const [officeChoice, setOfficeChoice] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement | null>(null);
  const id = useId();
  const member = overview.staff.find((entry) => entry.id === staffId) ?? null;
  const officeId = officeChoice ?? member?.officeId ?? "";
  const officeNames = new Map<string, string>(
    overview.offices.map((office) => [office.id, office.name])
  );
  const targetOffice = overview.offices.find((office) => office.id === officeId) ?? null;

  const chooseStaff = (value: string) => {
    setStaffId(value);
    setOfficeChoice(null);
    setProblem(null);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) {
      return;
    }
    if (!member) {
      setProblem("Choose a staff member.");
      return;
    }
    const nextReasonError = reasonProblem(reason);
    setProblem(null);
    setReasonError(nextReasonError);
    if (nextReasonError) {
      reasonRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      await assign({
        officeId: targetOffice?.id ?? null,
        reason: reason.trim(),
        staffId: member.id,
      });
      toast.success(
        targetOffice
          ? `${member.name} now checks in at ${targetOffice.name}.`
          : `${member.name} has no office assigned.`
      );
      setReason("");
      setOfficeChoice(null);
    } catch (error) {
      setProblem(formatConvexError(error, "Couldn't save the assignment. Try again."));
    }
    setSaving(false);
  };

  return (
    <Panel subtitle="The office's rule applies when this person clocks in." title="Staff office">
      <form className="grid gap-4" noValidate onSubmit={submit}>
        <div className="grid gap-1.5">
          <label className={LABEL} htmlFor={`${id}-staff`}>
            Staff member
          </label>
          <Select
            aria-describedby={member ? `${id}-staff-hint` : undefined}
            className="portal-input"
            id={`${id}-staff`}
            onValueChange={chooseStaff}
            options={[
              { disabled: true, label: "Choose a staff member", value: "" },
              ...overview.staff.map((entry) => ({ label: entry.name, value: entry.id })),
            ]}
            value={staffId}
          />
          {member ? (
            <p className={HINT} id={`${id}-staff-hint`}>
              Current office:{" "}
              {member.officeId ? (officeNames.get(member.officeId) ?? "Unknown") : "none"}
              {member.freeTextLocation ? ` · Profile location: ${member.freeTextLocation}` : ""}
            </p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <label className={LABEL} htmlFor={`${id}-office`}>
            Office
          </label>
          <Select
            className="portal-input"
            disabled={!member}
            id={`${id}-office`}
            onValueChange={setOfficeChoice}
            options={[
              { label: "No office", value: "" },
              ...overview.offices.map((office) => ({ label: office.name, value: office.id })),
            ]}
            value={officeId}
          />
        </div>
        <ReasonField
          error={reasonError}
          inputRef={reasonRef}
          onChange={setReason}
          placeholder="For example: moved to the new branch"
          value={reason}
        />
        <FieldError id={`${id}-problem`} message={problem} />
        <div className="flex justify-end">
          <button
            aria-busy={saving || undefined}
            className="portal-small-btn"
            disabled={saving}
            type="submit"
          >
            {saving ? "Saving…" : "Save assignment"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

function UnmatchedNetworks({ overview }: { overview: OfficeCheckInOverview }) {
  const officeNames = new Map(overview.offices.map((office) => [office.id, office.name]));
  return (
    <Panel
      subtitle="Network prefixes seen at check-in that didn't match an office range. Use them to find each office's real ranges; a prefix alone doesn't prove where someone was."
      title="Unmatched networks seen during the pilot"
    >
      {overview.unmatchedNetworks.length === 0 ? (
        <p className="rounded-xl border border-brand-border border-dashed px-3 py-3 text-brand-muted text-sm">
          None yet. Prefixes appear here after people check in.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-start text-sm">
            <thead className="text-brand-muted text-xs">
              <tr className="border-brand-border border-b">
                <th className="py-2 pe-3 text-start font-normal" scope="col">
                  Office
                </th>
                <th className="py-2 pe-3 text-start font-normal" scope="col">
                  Prefix
                </th>
                <th className="py-2 pe-3 text-end font-normal" scope="col">
                  Seen
                </th>
                <th className="py-2 pe-3 text-end font-normal" scope="col">
                  Last seen
                </th>
                <th className="py-2 text-start font-normal" scope="col">
                  Why it didn't match
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/60">
              {overview.unmatchedNetworks.map((entry) => (
                <tr key={`${entry.officeId}|${entry.prefix}`}>
                  <td className="py-2 pe-3">{officeNames.get(entry.officeId) ?? "—"}</td>
                  <td className="py-2 pe-3 font-mono text-xs">{entry.prefix}</td>
                  <td className="py-2 pe-3 text-end tabular-nums">{entry.count}</td>
                  <td className="py-2 pe-3 text-end tabular-nums">
                    {formatWorkDate(entry.lastWorkDate)}
                  </td>
                  <td className="py-2 text-brand-muted text-xs">
                    {entry.reasons
                      .map((reason) =>
                        hasOwnKey(NETWORK_REASON_SHORT, reason)
                          ? NETWORK_REASON_SHORT[reason]
                          : reason
                      )
                      .join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function RecentAudit({
  overview,
  timeZone,
}: {
  overview: OfficeCheckInOverview;
  timeZone: string;
}) {
  return (
    <Panel subtitle={`Latest 25 changes. Times in ${timeZone}.`} title="Recent audit">
      {overview.recentAudit.length === 0 ? (
        <p className="text-brand-muted text-sm">No changes recorded yet.</p>
      ) : (
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
      )}
    </Panel>
  );
}

/** Admin area: offices, each office's rule, staff assignment, pilot networks and audit. */
export function OfficeRulesAdmin({
  overview,
  timeZone,
}: {
  overview: OfficeCheckInOverview | undefined;
  timeZone: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!overview) {
    return (
      <Panel title="Office rules">
        <p className="text-brand-muted text-sm" role="status">
          Loading office rules…
        </p>
      </Panel>
    );
  }
  const selected =
    overview.offices.find((office) => office.id === selectedId) ?? overview.offices[0] ?? null;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <Panel
        action={
          <span className="inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-brand-light px-3 text-brand-muted text-xs">
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            Admin only
          </span>
        }
        subtitle="Set what each office checks at clock-in. Every save is versioned and audited."
        title="Office rules"
      >
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          {/* Explicit minmax(0,1fr) tracks here and above stop long office names and input
              widths from widening the column past the panel. */}
          <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4">
            <OfficeList
              offices={overview.offices}
              onSelect={setSelectedId}
              selectedId={selected?.id ?? null}
            />
            <CreateOfficeForm onCreated={setSelectedId} />
          </div>
          <div className="min-w-0 border-brand-border/70 xl:border-s xl:ps-6">
            {selected ? (
              <OfficeRuleEditor
                key={`${selected.id}:${selected.rule?.version ?? 0}`}
                office={selected}
              />
            ) : (
              <p className="text-brand-muted text-sm">Add an office to set its rule.</p>
            )}
          </div>
        </div>
      </Panel>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
        <StaffAssignment overview={overview} />
        <UnmatchedNetworks overview={overview} />
      </div>
      <RecentAudit overview={overview} timeZone={timeZone} />
    </div>
  );
}
