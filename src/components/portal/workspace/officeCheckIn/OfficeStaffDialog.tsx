"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Check, Loader2, Search } from "lucide-react";
import { type ChangeEvent, useId, useState } from "react";
import { usePortalToast } from "@/components/portal/PortalToast";
import { ControlledDialogClose, ControlledDialogTitle } from "@/components/ui/application-dialog";
import { formatConvexError } from "../portalWorkspaceListHelpers";
import { DialogBody, DialogFooter, FIELD_HINT, OfficeDialog } from "./OfficeCheckInParts";
import type { OfficeCheckInOverview, OverviewOffice } from "./officeCheckInTypes";

type StaffMember = OfficeCheckInOverview["staff"][number];
type StaffId = Id<"staffUsers">;
type SaveResult = { error: string; kind: "failed" } | { kind: "done" } | { kind: "saving" };

interface Change {
  member: StaffMember;
  officeId: Id<"offices"> | null;
}

function pluralPeople(count: number) {
  return count === 1 ? "1 person" : `${count} people`;
}

/** The people whose ticked state differs from their current office, in list order. */
function staffChanges(
  staff: readonly StaffMember[],
  officeId: Id<"offices">,
  ticked: ReadonlySet<StaffId>
): Change[] {
  return staff.flatMap((member) => {
    const here = member.officeId === officeId;
    const wanted = ticked.has(member.id);
    if (here === wanted) {
      return [];
    }
    return [{ member, officeId: wanted ? officeId : null }];
  });
}

function ResultMark({ result }: { result: SaveResult | undefined }) {
  if (!result) {
    return null;
  }
  if (result.kind === "saving") {
    return (
      <span className="flex items-center gap-1 text-brand-muted text-xs">
        <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
        Saving…
      </span>
    );
  }
  if (result.kind === "done") {
    return (
      <span className="flex items-center gap-1 text-emerald-700 text-xs">
        <Check aria-hidden="true" className="size-3.5" />
        Saved
      </span>
    );
  }
  return <span className="block text-red-700 text-xs">Not saved: {result.error}</span>;
}

function StaffRow({
  checked,
  member,
  officeNames,
  onToggle,
  result,
  thisOfficeId,
}: {
  checked: boolean;
  member: StaffMember;
  officeNames: ReadonlyMap<string, string>;
  onToggle: (id: StaffId, checked: boolean) => void;
  result: SaveResult | undefined;
  thisOfficeId: Id<"offices">;
}) {
  const id = useId();
  const toggle = (event: ChangeEvent<HTMLInputElement>) =>
    onToggle(member.id, event.currentTarget.checked);
  const elsewhere =
    member.officeId && member.officeId !== thisOfficeId
      ? `Now at ${officeNames.get(member.officeId) ?? "another office"}`
      : null;
  const subline = elsewhere ?? (member.officeId ? null : "No office");
  return (
    <li>
      <label
        className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-brand-light/70"
        htmlFor={id}
      >
        <input
          aria-describedby={subline ? `${id}-office` : undefined}
          checked={checked}
          className="size-4 shrink-0 accent-citius-blue"
          id={id}
          onChange={toggle}
          type="checkbox"
        />
        <span className="min-w-0 flex-1">
          <span className="block break-words text-brand-dark text-sm">{member.name}</span>
          {subline ? (
            <span className="block text-brand-muted text-xs" id={`${id}-office`}>
              {subline}
            </span>
          ) : null}
          <ResultMark result={result} />
        </span>
      </label>
    </li>
  );
}

function StaffChecklist({
  office,
  offices,
  onBusyChange,
  onDone,
  staff,
}: {
  office: OverviewOffice;
  offices: OfficeCheckInOverview["offices"];
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
  staff: readonly StaffMember[];
}) {
  const toast = usePortalToast();
  const assign = useMutation(api.crm.officeCheckInAdmin.assignStaffOffice);
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [ticked, setTicked] = useState<ReadonlySet<StaffId>>(
    () => new Set(staff.flatMap((member) => (member.officeId === office.id ? [member.id] : [])))
  );
  const [results, setResults] = useState<ReadonlyMap<StaffId, SaveResult>>(new Map());
  const [saving, setSaving] = useState(false);
  const officeNames = new Map<string, string>(offices.map((entry) => [entry.id, entry.name]));

  // Someone already saved is no longer pending, even before the live list catches up.
  const pending = staffChanges(staff, office.id, ticked).filter(
    (change) => results.get(change.member.id)?.kind !== "done"
  );
  const adding = pending.filter((change) => change.officeId !== null).length;
  const removing = pending.length - adding;
  const failed = [...results.values()].filter((result) => result.kind === "failed").length;
  const summary =
    [
      adding ? `${pluralPeople(adding)} to add` : "",
      removing ? `${pluralPeople(removing)} to remove` : "",
      failed > 0 && !saving ? `${pluralPeople(failed)} not saved, save again to retry` : "",
    ]
      .filter(Boolean)
      .join(" · ") || "No changes yet.";
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? staff.filter((member) => member.name.toLowerCase().includes(needle))
    : staff;

  const toggle = (id: StaffId, checked: boolean) => {
    setTicked((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
    setResults((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  };
  const setResult = (id: StaffId, result: SaveResult) =>
    setResults((current) => new Map(current).set(id, result));

  // One person per call, one after another, so each row shows its own outcome
  // and a failure doesn't stop the rest.
  const save = async () => {
    if (saving || pending.length === 0) {
      return;
    }
    setSaving(true);
    onBusyChange(true);
    let failures = 0;
    for (const { member, officeId } of pending) {
      const staffId = member.id;
      setResult(staffId, { kind: "saving" });
      const reason = officeId
        ? `Assigned to ${office.name} in office setup`
        : `Removed from ${office.name} in office setup`;
      try {
        // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose; see above.
        await assign({ officeId, reason, staffId });
        setResult(staffId, { kind: "done" });
      } catch (error) {
        failures += 1;
        setResult(staffId, {
          error: formatConvexError(error, "Try again."),
          kind: "failed",
        });
      }
    }
    setSaving(false);
    onBusyChange(false);
    if (failures === 0) {
      toast.success(`Staff updated for ${office.name}.`);
      onDone();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DialogBody>
        <ControlledDialogTitle className="font-heading font-semibold text-citius-blue text-lg">
          Staff at {office.name}
        </ControlledDialogTitle>
        <p className="mt-1 text-brand-muted text-sm">
          Tick everyone who checks in at this office. Ticking someone from another office moves them
          here.
        </p>
        <div className="relative mt-4">
          <label className="sr-only" htmlFor={searchId}>
            Search staff
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-brand-muted"
          />
          <input
            autoComplete="off"
            className="portal-input ps-9! text-base sm:text-sm"
            id={searchId}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search by name"
            type="search"
            value={query}
          />
        </div>
        <p className={`${FIELD_HINT} mt-2 tabular-nums`}>
          {ticked.size} ticked · {staff.length} active staff
        </p>
        {visible.length === 0 ? (
          <p className="mt-3 rounded-xl border border-brand-border border-dashed px-3 py-3 text-brand-muted text-sm">
            No one matches “{query.trim()}”.
          </p>
        ) : (
          <ul aria-label="Active staff" className="mt-2 grid gap-0.5">
            {visible.map((member) => (
              <StaffRow
                checked={ticked.has(member.id)}
                key={member.id}
                member={member}
                officeNames={officeNames}
                onToggle={toggle}
                result={results.get(member.id)}
                thisOfficeId={office.id}
              />
            ))}
          </ul>
        )}
      </DialogBody>
      <div className="border-brand-border/70 border-t px-5 pt-3 sm:px-6" role="status">
        <p className="text-brand-dark text-sm tabular-nums">{summary}</p>
        {removing > 0 ? (
          <p className={`${FIELD_HINT} mt-0.5`}>
            People you remove have no office and can't clock in until they're assigned again.
          </p>
        ) : null}
      </div>
      <DialogFooter>
        <ControlledDialogClose className="portal-outline-btn" disabled={saving} type="button">
          {results.size > 0 && !saving ? "Close" : "Cancel"}
        </ControlledDialogClose>
        <button
          aria-busy={saving || undefined}
          className="portal-primary-btn"
          disabled={saving}
          onClick={save}
          type="button"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </DialogFooter>
    </div>
  );
}

/** Searchable checklist of active staff for one office. Saves one person per call. */
export function OfficeStaffDialog({
  office,
  onClose,
  overview,
}: {
  office: OverviewOffice | null;
  onClose: () => void;
  overview: OfficeCheckInOverview;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <OfficeDialog busy={busy} onClose={onClose} open={Boolean(office)}>
      {office ? (
        <StaffChecklist
          key={office.id}
          office={office}
          offices={overview.offices}
          onBusyChange={setBusy}
          onDone={onClose}
          staff={overview.staff}
        />
      ) : null}
    </OfficeDialog>
  );
}
