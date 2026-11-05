"use client";

import { api } from "@convex/_generated/api";
import {
  CHECK_IN_REQUIREMENTS,
  type CheckInRequirement,
  type EnforcementMode,
  type GeofenceRule,
  MAX_ACCURACY_LIMIT_METERS,
  MAX_GEOFENCE_RADIUS_METERS,
  MAX_NETWORK_ENTRIES,
  MIN_ACCURACY_LIMIT_METERS,
  MIN_GEOFENCE_RADIUS_METERS,
  NETWORK_ENTRY_KINDS,
  type NetworkEntryKind,
  requiresLocation,
  requiresNetwork,
  validateBranchRule,
} from "@convex/crm/officeCheckInVerification";
import { useMutation } from "convex/react";
import { type ChangeEvent, type FormEvent, useId, useRef, useState } from "react";
import { usePortalConfirm } from "@/components/portal/PortalConfirmDialog";
import { usePortalToast } from "@/components/portal/PortalToast";
import { Select } from "@/components/ui/application-select";
import {
  ENFORCEMENT_LABELS,
  NETWORK_KIND_HELP,
  NETWORK_KIND_LABELS,
  REQUIREMENT_HELP,
  REQUIREMENT_LABELS,
  reasonProblem,
} from "@/lib/officeCheckIn/presentation";
import { formatConvexError } from "../portalWorkspaceListHelpers";
import { ReasonField } from "./OfficeCheckInParts";
import type { OfficeRule, OverviewOffice } from "./officeCheckInTypes";

interface NetworkDraft {
  cidr: string;
  key: string;
  kind: NetworkEntryKind;
  label: string;
}

interface RuleDraft {
  accuracy: string;
  latitude: string;
  longitude: string;
  mode: EnforcementMode;
  networks: NetworkDraft[];
  radius: string;
  reason: string;
  requirement: CheckInRequirement | "";
  timeZone: string;
}

const LABEL = "font-medium text-brand-dark text-sm";
const HINT = "text-brand-muted text-xs";

function numberText(value: number | undefined) {
  return value === undefined ? "" : String(value);
}

function draftFromRule(rule: OfficeRule | null): RuleDraft {
  return {
    accuracy: numberText(rule?.geofence?.maxAccuracyMeters),
    latitude: numberText(rule?.geofence?.latitude),
    longitude: numberText(rule?.geofence?.longitude),
    mode: rule?.enforcementMode ?? "report_only",
    networks: (rule?.networks ?? []).map((entry, index) => ({ ...entry, key: `saved-${index}` })),
    radius: numberText(rule?.geofence?.radiusMeters),
    reason: "",
    requirement: rule?.requirement ?? "",
    timeZone: rule?.timeZone ?? "",
  };
}

function parseNumber(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** Turns the four geofence fields into a rule, or explains what is missing. */
export function parseGeofence(
  draft: Pick<RuleDraft, "accuracy" | "latitude" | "longitude" | "radius">
): { geofence: GeofenceRule | null; problem: null } | { geofence: null; problem: string } {
  const fields = [draft.latitude, draft.longitude, draft.radius, draft.accuracy];
  if (fields.every((field) => !field.trim())) {
    return { geofence: null, problem: null };
  }
  const [latitude, longitude, radiusMeters, maxAccuracyMeters] = fields.map(parseNumber);
  if (
    latitude === null ||
    longitude === null ||
    radiusMeters === null ||
    maxAccuracyMeters === null
  ) {
    return {
      geofence: null,
      problem:
        "Fill in latitude, longitude, radius and accuracy limit as numbers, or leave all four empty.",
    };
  }
  return { geofence: { latitude, longitude, maxAccuracyMeters, radiusMeters }, problem: null };
}

export interface RuleSubmission {
  enablingEnforce: boolean;
  geofence: GeofenceRule | null;
  networks: { cidr: string; kind: NetworkEntryKind; label: string }[];
  requirement: CheckInRequirement;
}

export interface RuleDraftCheck {
  problems: string[];
  submission: RuleSubmission | null;
}

/** Client-side check that mirrors the server's validation before anything is sent. */
export function checkRuleDraft(
  draft: RuleDraft,
  savedMode: EnforcementMode | null
): RuleDraftCheck {
  const problems: string[] = [];
  if (!draft.requirement) {
    problems.push("Choose what this office checks.");
  }
  const networks = draft.networks
    .filter((entry) => entry.cidr.trim() || entry.label.trim())
    .map((entry) => ({ cidr: entry.cidr.trim(), kind: entry.kind, label: entry.label.trim() }));
  const geofence = parseGeofence(draft);
  if (geofence.problem) {
    problems.push(geofence.problem);
  }
  if (!draft.requirement || geofence.problem) {
    return { problems, submission: null };
  }
  problems.push(
    ...validateBranchRule({
      enforcementMode: draft.mode,
      geofence: geofence.geofence,
      networks,
      requirement: draft.requirement,
    })
  );
  if (problems.length > 0) {
    return { problems, submission: null };
  }
  return {
    problems,
    submission: {
      enablingEnforce: draft.mode === "enforce" && savedMode !== "enforce",
      geofence: geofence.geofence,
      networks,
      requirement: draft.requirement,
    },
  };
}

function TextField({
  hint,
  inputMode,
  label,
  mono = false,
  onChange,
  placeholder,
  value,
}: {
  hint?: string;
  inputMode?: "decimal" | "numeric" | "text";
  label: string;
  mono?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const id = useId();
  const handleChange = (event: ChangeEvent<HTMLInputElement>) =>
    onChange(event.currentTarget.value);
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <label className={LABEL} htmlFor={id}>
        {label}
      </label>
      <input
        aria-describedby={hint ? `${id}-hint` : undefined}
        autoComplete="off"
        className={`portal-input ${mono ? "font-mono" : ""} tabular-nums`}
        id={id}
        inputMode={inputMode}
        onChange={handleChange}
        placeholder={placeholder}
        spellCheck={false}
        value={value}
      />
      {hint ? (
        <p className={HINT} id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function NetworkRow({
  entry,
  index,
  onChange,
  onRemove,
}: {
  entry: NetworkDraft;
  index: number;
  onChange: (key: string, patch: Partial<NetworkDraft>) => void;
  onRemove: (key: string) => void;
}) {
  const id = useId();
  const setCidr = (value: string) => onChange(entry.key, { cidr: value });
  const setLabel = (value: string) => onChange(entry.key, { label: value });
  const setKind = (value: string) => {
    const kind = NETWORK_ENTRY_KINDS.find((candidate) => candidate === value);
    if (kind) {
      onChange(entry.key, { kind });
    }
  };
  const remove = () => onRemove(entry.key);
  return (
    <li className="grid gap-3 rounded-xl border border-brand-border/70 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-start">
      <TextField
        label={`Range ${index + 1}`}
        mono
        onChange={setCidr}
        placeholder="203.0.113.0/24"
        value={entry.cidr}
      />
      <TextField
        label="Label"
        onChange={setLabel}
        placeholder="Main office line"
        value={entry.label}
      />
      <div className="grid min-w-0 gap-1.5">
        <label className={LABEL} htmlFor={`${id}-kind`}>
          Kind
        </label>
        <Select
          aria-describedby={`${id}-kind-hint`}
          className="portal-input"
          id={`${id}-kind`}
          onValueChange={setKind}
          options={NETWORK_ENTRY_KINDS.map((kind) => ({
            label: NETWORK_KIND_LABELS[kind],
            value: kind,
          }))}
          value={entry.kind}
        />
        <p className={HINT} id={`${id}-kind-hint`}>
          {NETWORK_KIND_HELP[entry.kind]}
        </p>
      </div>
      <button
        aria-label={`Remove range ${index + 1}`}
        className="portal-danger-btn md:mt-7"
        onClick={remove}
        type="button"
      >
        Remove
      </button>
    </li>
  );
}

function ModeField({
  mode,
  onChange,
  savedMode,
}: {
  mode: EnforcementMode;
  onChange: (mode: EnforcementMode) => void;
  savedMode: EnforcementMode | null;
}) {
  const choose = (event: ChangeEvent<HTMLInputElement>) =>
    onChange(event.currentTarget.value === "enforce" ? "enforce" : "report_only");
  return (
    <fieldset className="grid gap-2">
      <legend className={LABEL}>Mode</legend>
      <label className="flex min-h-10 items-start gap-2 text-brand-dark text-sm">
        <input
          checked={mode === "report_only"}
          className="mt-1 size-4 accent-citius-blue"
          name="mode"
          onChange={choose}
          type="radio"
          value="report_only"
        />
        <span>
          {ENFORCEMENT_LABELS.report_only}
          <span className="block text-brand-muted text-xs">
            Results are recorded for review. Nothing is blocked. Use this for the pilot.
          </span>
        </span>
      </label>
      <label className="flex min-h-10 items-start gap-2 text-brand-dark text-sm">
        <input
          checked={mode === "enforce"}
          className="mt-1 size-4 accent-citius-blue"
          name="mode"
          onChange={choose}
          type="radio"
          value="enforce"
        />
        <span>
          {ENFORCEMENT_LABELS.enforce}
          <span className="block text-brand-muted text-xs">
            Check-ins that don't pass wait for a manager's review before they count.
          </span>
        </span>
      </label>
      {mode === "enforce" && savedMode !== "enforce" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 text-xs">
          Turning on Enforce affects everyone assigned to this office. Network and location results
          are evidence, not proof, so some honest check-ins will need review. You'll be asked to
          confirm when you save.
        </p>
      ) : null}
    </fieldset>
  );
}

function useRuleEditor(office: OverviewOffice) {
  const toast = usePortalToast();
  const { confirm } = usePortalConfirm();
  const saveRule = useMutation(api.crm.officeCheckInAdmin.saveRule);
  const [draft, setDraft] = useState(() => draftFromRule(office.rule));
  const [problems, setProblems] = useState<string[]>([]);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement | null>(null);
  const problemsRef = useRef<HTMLDivElement | null>(null);
  const savedMode = office.rule?.enforcementMode ?? null;

  const update = (patch: Partial<RuleDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const updateNetwork = (key: string, patch: Partial<NetworkDraft>) =>
    setDraft((current) => ({
      ...current,
      networks: current.networks.map((entry) =>
        entry.key === key ? { ...entry, ...patch } : entry
      ),
    }));
  const removeNetwork = (key: string) =>
    setDraft((current) => ({
      ...current,
      networks: current.networks.filter((entry) => entry.key !== key),
    }));
  const addNetwork = () =>
    setDraft((current) => ({
      ...current,
      networks: [
        ...current.networks,
        { cidr: "", key: crypto.randomUUID(), kind: "office", label: "" },
      ],
    }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) {
      return;
    }
    setServerError("");
    const checked = checkRuleDraft(draft, savedMode);
    const nextReasonError = reasonProblem(draft.reason);
    setProblems(checked.problems);
    setReasonError(nextReasonError);
    if (!checked.submission) {
      queueMicrotask(() => problemsRef.current?.focus());
      return;
    }
    if (nextReasonError) {
      reasonRef.current?.focus();
      return;
    }
    const { submission } = checked;
    if (submission.enablingEnforce) {
      const confirmed = await confirm({
        confirmLabel: "Turn on Enforce",
        message: `Check-ins at ${office.name} that don't pass will wait for a manager's review before they count. Staff can still clock in and out. Results are evidence, not proof, so expect some honest check-ins to need review.`,
        title: `Turn on Enforce for ${office.name}?`,
      });
      if (!confirmed) {
        return;
      }
    }
    setSaving(true);
    try {
      const version = await saveRule({
        confirmEnforcement: submission.enablingEnforce,
        enforcementMode: draft.mode,
        expectedVersion: office.rule?.version ?? null,
        geofence: submission.geofence,
        networks: submission.networks,
        officeId: office.id,
        reason: draft.reason.trim(),
        requirement: submission.requirement,
        timeZone: draft.timeZone.trim(),
      });
      toast.success(`Rule saved for ${office.name} (version ${version}).`);
      update({ reason: "" });
    } catch (error) {
      setServerError(formatConvexError(error, "Couldn't save the rule. Try again."));
    }
    setSaving(false);
  };

  return {
    addNetwork,
    draft,
    problems,
    problemsRef,
    reasonError,
    reasonRef,
    removeNetwork,
    savedMode,
    saving,
    serverError,
    submit,
    update,
    updateNetwork,
  };
}

/** Edits one office's verification rule. Remount with a new key when the saved version changes. */
export function OfficeRuleEditor({ office }: { office: OverviewOffice }) {
  const editor = useRuleEditor(office);
  const { draft } = editor;
  const id = useId();
  const checksNetwork = !draft.requirement || requiresNetwork(draft.requirement);
  const checksLocation = !draft.requirement || requiresLocation(draft.requirement);
  const setRequirement = (value: string) => {
    const requirement = CHECK_IN_REQUIREMENTS.find((candidate) => candidate === value);
    if (requirement) {
      editor.update({ requirement });
    }
  };
  const setMode = (mode: EnforcementMode) => editor.update({ mode });
  return (
    <form className="grid gap-6" noValidate onSubmit={editor.submit}>
      <div>
        <h3 className="font-heading font-semibold text-base text-brand-dark">{office.name} rule</h3>
        <p className={HINT}>
          {office.rule
            ? `Version ${office.rule.version}. Saving creates the next version and records your reason.`
            : "No rule yet. Until one is saved, check-ins here are recorded as uncertain."}
        </p>
      </div>

      <div className="grid gap-1.5">
        <label className={LABEL} htmlFor={`${id}-requirement`}>
          What this office checks
        </label>
        <Select
          aria-describedby={`${id}-requirement-hint`}
          className="portal-input max-w-md"
          id={`${id}-requirement`}
          onValueChange={setRequirement}
          options={[
            { disabled: true, label: "Choose what to check", value: "" },
            ...CHECK_IN_REQUIREMENTS.map((requirement) => ({
              label: REQUIREMENT_LABELS[requirement],
              value: requirement,
            })),
          ]}
          value={draft.requirement}
        />
        <p className={HINT} id={`${id}-requirement-hint`}>
          {draft.requirement ? `${REQUIREMENT_HELP[draft.requirement]} ` : ""}
          Staff can't pick a different or easier method when they clock in.
        </p>
      </div>

      <fieldset className="grid gap-3">
        <legend className={LABEL}>Office network ranges</legend>
        <p className={HINT}>
          {checksNetwork ? "" : "Not used by the current choice. "}IPv4 /16 or narrower, IPv6 /32 or
          narrower. Only ranges marked Office can pass; shared and VPN ranges stay uncertain.
        </p>
        {draft.networks.length > 0 ? (
          <ul className="grid gap-3">
            {draft.networks.map((entry, index) => (
              <NetworkRow
                entry={entry}
                index={index}
                key={entry.key}
                onChange={editor.updateNetwork}
                onRemove={editor.removeNetwork}
              />
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-brand-border border-dashed px-3 py-3 text-brand-muted text-xs">
            No ranges yet. Add the office's public range, for example 203.0.113.0/24 or
            2001:db8::/48.
          </p>
        )}
        <div>
          <button
            className="portal-small-btn"
            disabled={draft.networks.length >= MAX_NETWORK_ENTRIES}
            onClick={editor.addNetwork}
            type="button"
          >
            Add network range
          </button>
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className={LABEL}>Office location</legend>
        <p className={HINT}>
          {checksLocation ? "" : "Not used by the current choice. "}Decimal degrees for the
          building. Leave all four empty if this office doesn't check location.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <TextField
            inputMode="decimal"
            label="Latitude"
            onChange={(value) => editor.update({ latitude: value })}
            placeholder="0.000000"
            value={draft.latitude}
          />
          <TextField
            inputMode="decimal"
            label="Longitude"
            onChange={(value) => editor.update({ longitude: value })}
            placeholder="0.000000"
            value={draft.longitude}
          />
          <TextField
            hint={`${MIN_GEOFENCE_RADIUS_METERS}–${MAX_GEOFENCE_RADIUS_METERS} metres.`}
            inputMode="numeric"
            label="Radius (m)"
            onChange={(value) => editor.update({ radius: value })}
            value={draft.radius}
          />
          <TextField
            hint={`${MIN_ACCURACY_LIMIT_METERS}–${MAX_ACCURACY_LIMIT_METERS} metres. Less precise readings are uncertain.`}
            inputMode="numeric"
            label="Accuracy limit (m)"
            onChange={(value) => editor.update({ accuracy: value })}
            value={draft.accuracy}
          />
        </div>
      </fieldset>

      <div className="max-w-md">
        <TextField
          hint="Sets the work date and the times staff see. Leave empty for Asia/Kolkata."
          label="Time zone"
          onChange={(value) => editor.update({ timeZone: value })}
          placeholder="Asia/Kolkata"
          value={draft.timeZone}
        />
      </div>

      <ModeField mode={draft.mode} onChange={setMode} savedMode={editor.savedMode} />

      <ReasonField
        error={editor.reasonError}
        help="Saved in the rule's audit entry with your name."
        inputRef={editor.reasonRef}
        onChange={(value) => editor.update({ reason: value })}
        placeholder="For example: adding the second floor's network"
        value={draft.reason}
      />

      {editor.problems.length > 0 ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm"
          ref={editor.problemsRef}
          role="alert"
          tabIndex={-1}
        >
          <p className="font-medium">Fix these before saving:</p>
          <ul className="mt-1 list-disc ps-5">
            {editor.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {editor.serverError ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm"
          role="alert"
        >
          {editor.serverError}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          aria-busy={editor.saving || undefined}
          className="portal-primary-btn"
          disabled={editor.saving}
          type="submit"
        >
          {editor.saving ? "Saving…" : "Save rule"}
        </button>
      </div>
    </form>
  );
}
