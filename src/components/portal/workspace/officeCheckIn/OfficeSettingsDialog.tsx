"use client";

import { api } from "@convex/_generated/api";
import {
  CHECK_IN_REQUIREMENTS,
  type EnforcementMode,
  MAX_NETWORK_ENTRIES,
  NETWORK_ENTRY_KINDS,
  requiresLocation,
  requiresNetwork,
} from "@convex/crm/officeCheckInVerification";
import { useMutation } from "convex/react";
import { ChevronRight } from "lucide-react";
import { type ChangeEvent, type FormEvent, useId, useRef, useState } from "react";
import { usePortalConfirm } from "@/components/portal/PortalConfirmDialog";
import { usePortalToast } from "@/components/portal/PortalToast";
import { ControlledDialogClose, ControlledDialogTitle } from "@/components/ui/application-dialog";
import { Select } from "@/components/ui/application-select";
import {
  ENFORCEMENT_LABELS,
  NETWORK_KIND_LABELS,
  REQUIREMENT_CHOICES,
} from "@/lib/officeCheckIn/presentation";
import {
  checkRuleDraft,
  draftFromRule,
  formatCoordinates,
  mapLinkFor,
  type NetworkDraft,
  parseCoordinates,
  type RuleDraft,
  type RuleSubmission,
} from "@/lib/officeCheckIn/ruleDraft";
import { formatConvexError } from "../portalWorkspaceListHelpers";
import {
  DialogBody,
  DialogFooter,
  FIELD_HINT,
  FIELD_LABEL,
  OfficeDialog,
  ServerError,
} from "./OfficeCheckInParts";
import type { OverviewOffice } from "./officeCheckInTypes";

const INPUT = "portal-input text-base sm:text-sm";

function emptyAddress(): NetworkDraft {
  return { cidr: "", key: crypto.randomUUID(), kind: "office", label: "" };
}

function initialDraft(office: OverviewOffice): RuleDraft {
  const draft = draftFromRule(office.rule, office.name);
  return draft.networks.length > 0 ? draft : { ...draft, networks: [emptyAddress()] };
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
      <label className={FIELD_LABEL} htmlFor={id}>
        {label}
      </label>
      <input
        aria-describedby={hint ? `${id}-hint` : undefined}
        autoComplete="off"
        className={`${INPUT} ${mono ? "font-mono" : ""} tabular-nums`}
        id={id}
        inputMode={inputMode}
        onChange={handleChange}
        placeholder={placeholder}
        spellCheck={false}
        value={value}
      />
      {hint ? (
        <p className={FIELD_HINT} id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** One field for the pin: paste what Google Maps shows and see it read back. */
function LocationField({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  const id = useId();
  const parsed = parseCoordinates(value);
  const handleChange = (event: ChangeEvent<HTMLInputElement>) =>
    onChange(event.currentTarget.value);
  const applySwapped = () => {
    if (parsed.kind === "swapped") {
      onChange(formatCoordinates(parsed.latitude, parsed.longitude));
    }
  };
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <label className={FIELD_LABEL} htmlFor={id}>
        Office location
      </label>
      <input
        aria-describedby={`${id}-hint ${id}-status`}
        aria-invalid={parsed.kind === "invalid" || parsed.kind === "swapped" ? true : undefined}
        autoComplete="off"
        className={`${INPUT} font-mono tabular-nums aria-[invalid=true]:border-red-400`}
        id={id}
        onChange={handleChange}
        placeholder="19.2183687, 72.9705434"
        spellCheck={false}
        value={value}
      />
      <p className={FIELD_HINT} id={`${id}-hint`}>
        In Google Maps, right-click the office and click the numbers at the top to copy them, then
        paste here.
      </p>
      <div aria-live="polite" className="text-sm" id={`${id}-status`}>
        {parsed.kind === "ok" ? (
          <p className="text-brand-dark">
            Pin set at {formatCoordinates(parsed.latitude, parsed.longitude)}.{" "}
            <a
              className="text-citius-blue underline underline-offset-2"
              href={mapLinkFor(parsed.latitude, parsed.longitude)}
              rel="noopener noreferrer"
              target="_blank"
            >
              Check it on Google Maps
            </a>
          </p>
        ) : null}
        {parsed.kind === "invalid" ? <p className="text-red-700">{parsed.message}</p> : null}
        {parsed.kind === "swapped" ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-red-700">These look the wrong way round. Latitude comes first.</p>
            <button className="portal-small-btn" onClick={applySwapped} type="button">
              Use {formatCoordinates(parsed.latitude, parsed.longitude)}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AddressRow({
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
  const setCidr = (value: string) => onChange(entry.key, { cidr: value });
  const setLabel = (value: string) => onChange(entry.key, { label: value });
  const remove = () => onRemove(entry.key);
  return (
    <li className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
      <TextField
        label={`Address ${index + 1}`}
        mono
        onChange={setCidr}
        placeholder="203.0.113.10"
        value={entry.cidr}
      />
      <TextField label="Name" onChange={setLabel} placeholder="Main line" value={entry.label} />
      <button
        aria-label={`Remove address ${index + 1}`}
        className="portal-small-btn min-h-11 justify-self-start"
        onClick={remove}
        type="button"
      >
        Remove
      </button>
    </li>
  );
}

function AddressKindRow({
  entry,
  index,
  onChange,
}: {
  entry: NetworkDraft;
  index: number;
  onChange: (key: string, patch: Partial<NetworkDraft>) => void;
}) {
  const id = useId();
  const setKind = (value: string) => {
    const kind = NETWORK_ENTRY_KINDS.find((candidate) => candidate === value);
    if (kind) {
      onChange(entry.key, { kind });
    }
  };
  const name = entry.label.trim() || entry.cidr.trim() || `Address ${index + 1}`;
  return (
    <div className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] sm:items-center sm:gap-3">
      <label className="min-w-0 truncate text-brand-dark text-sm" htmlFor={`${id}-kind`}>
        {name}
      </label>
      <Select
        className="portal-input"
        id={`${id}-kind`}
        onValueChange={setKind}
        options={NETWORK_ENTRY_KINDS.map((kind) => ({
          label: NETWORK_KIND_LABELS[kind],
          value: kind,
        }))}
        value={entry.kind}
      />
    </div>
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
    <fieldset className="grid gap-1">
      <legend className={`${FIELD_LABEL} mb-1`}>Mode</legend>
      <label className="flex min-h-10 items-start gap-2 py-1 text-brand-dark text-sm">
        <input
          checked={mode === "report_only"}
          className="mt-0.5 size-4 shrink-0 accent-citius-blue"
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
      <label className="flex min-h-10 items-start gap-2 py-1 text-brand-dark text-sm">
        <input
          checked={mode === "enforce"}
          className="mt-0.5 size-4 shrink-0 accent-citius-blue"
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
        <p className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 text-xs">
          Turning on Enforce affects everyone assigned to this office. Location and internet results
          are evidence, not proof, so some honest check-ins will need review. You'll be asked to
          confirm when you save.
        </p>
      ) : null}
    </fieldset>
  );
}

function RequirementField({
  onChange,
  value,
}: {
  onChange: (value: RuleDraft["requirement"]) => void;
  value: RuleDraft["requirement"];
}) {
  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const requirement = CHECK_IN_REQUIREMENTS.find(
      (candidate) => candidate === event.currentTarget.value
    );
    if (requirement) {
      onChange(requirement);
    }
  };
  return (
    <fieldset className="grid gap-1">
      <legend className="mb-1 font-heading font-semibold text-base text-brand-dark">
        What should we check?
      </legend>
      {REQUIREMENT_CHOICES.map((choice) => (
        <label
          className="flex min-h-11 items-start gap-2.5 rounded-lg py-1.5 text-brand-dark text-sm"
          key={choice.value}
        >
          <input
            checked={value === choice.value}
            className="mt-0.5 size-4 shrink-0 accent-citius-blue"
            name="requirement"
            onChange={choose}
            type="radio"
            value={choice.value}
          />
          <span>
            <span className="font-medium">{choice.label}</span>
            <span className="block text-brand-muted text-xs">{choice.help}</span>
          </span>
        </label>
      ))}
      <p className={`${FIELD_HINT} mt-1`}>
        Staff can't choose a different check when they clock in.
      </p>
    </fieldset>
  );
}

function confirmCopy(officeName: string, turningOn: boolean) {
  return turningOn
    ? {
        confirmLabel: "Turn on Enforce",
        message: `Check-ins at ${officeName} that don't pass will wait for a manager's review before they count. Staff can still clock in and out. Results are evidence, not proof, so expect some honest check-ins to need review.`,
        title: `Turn on Enforce for ${officeName}?`,
      }
    : {
        confirmLabel: "Save with Enforce on",
        message: `${officeName} stays in Enforce mode, so check-ins that don't pass under these settings will wait for a manager's review.`,
        title: `Save ${officeName} with Enforce on?`,
      };
}

function useOfficeSettings(office: OverviewOffice, onDone: () => void) {
  const toast = usePortalToast();
  const { confirm } = usePortalConfirm();
  const saveRule = useMutation(api.crm.officeCheckInAdmin.saveRule);
  const [draft, setDraft] = useState(() => initialDraft(office));
  const [problems, setProblems] = useState<string[]>([]);
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const savedMode = office.rule?.enforcementMode ?? null;

  const update = (patch: Partial<RuleDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const updateAddress = (key: string, patch: Partial<NetworkDraft>) =>
    setDraft((current) => ({
      ...current,
      networks: current.networks.map((entry) =>
        entry.key === key ? { ...entry, ...patch } : entry
      ),
    }));
  const removeAddress = (key: string) =>
    setDraft((current) => ({
      ...current,
      networks: current.networks.filter((entry) => entry.key !== key),
    }));
  const addAddress = () =>
    setDraft((current) => ({ ...current, networks: [...current.networks, emptyAddress()] }));

  const save = async (submission: RuleSubmission) => {
    // The server asks for confirmation on every save that leaves an office in
    // Enforce, not only the save that turns it on.
    const enforce = submission.enforcementMode === "enforce";
    if (enforce && !(await confirm(confirmCopy(office.name, savedMode !== "enforce")))) {
      return;
    }
    setSaving(true);
    try {
      await saveRule({
        ...submission,
        confirmEnforcement: enforce,
        expectedVersion: office.rule?.version ?? null,
        officeId: office.id,
      });
      toast.success(`${office.name} saved.`);
      onDone();
    } catch (error) {
      setServerError(formatConvexError(error, "Couldn't save these settings. Try again."));
    }
    setSaving(false);
  };

  /** Returns false when the form has problems, so the caller can move focus to them. */
  const submit = async () => {
    if (saving) {
      return true;
    }
    setServerError("");
    const checked = checkRuleDraft(draft, office.rule);
    setProblems(checked.problems);
    if (!checked.submission) {
      return false;
    }
    await save(checked.submission);
    return true;
  };

  return {
    addAddress,
    draft,
    problems,
    removeAddress,
    savedMode,
    saving,
    serverError,
    submit,
    update,
    updateAddress,
  };
}

function OfficeSettingsForm({
  office,
  onBusyChange,
  onDone,
}: {
  office: OverviewOffice;
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
}) {
  const settings = useOfficeSettings(office, onDone);
  const { draft } = settings;
  const problemsRef = useRef<HTMLDivElement | null>(null);
  const reasonId = useId();
  const usesLocation = draft.requirement !== "" && requiresLocation(draft.requirement);
  const usesNetwork = draft.requirement !== "" && requiresNetwork(draft.requirement);
  const addresses = draft.networks.filter((entry) => entry.cidr.trim() || entry.label.trim());

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onBusyChange(true);
    const ok = await settings.submit();
    onBusyChange(false);
    if (!ok) {
      queueMicrotask(() => problemsRef.current?.focus());
    }
  };
  const setReason = (event: ChangeEvent<HTMLInputElement>) =>
    settings.update({ reason: event.currentTarget.value });

  return (
    <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={handleSubmit}>
      <DialogBody>
        <div className="mb-5">
          <ControlledDialogTitle className="font-heading font-semibold text-citius-blue text-lg">
            Edit {office.name}
          </ControlledDialogTitle>
          <p className="mt-1 text-brand-muted text-sm">
            {office.rule
              ? `${ENFORCEMENT_LABELS[office.rule.enforcementMode]} · version ${office.rule.version}`
              : "Not set up yet. Until it is, check-ins here are marked uncertain."}
          </p>
        </div>

        <div className="grid gap-6">
          <RequirementField
            onChange={(requirement) => settings.update({ requirement })}
            value={draft.requirement}
          />

          {usesLocation ? (
            <section
              aria-label="Location"
              className="grid gap-4 border-brand-border/70 border-t pt-5"
            >
              <LocationField
                onChange={(location) => settings.update({ location })}
                value={draft.location}
              />
              <div className="max-w-xs">
                <TextField
                  hint="How far from the pin still counts as the office."
                  inputMode="numeric"
                  label="Radius (metres)"
                  onChange={(radius) => settings.update({ radius })}
                  value={draft.radius}
                />
              </div>
            </section>
          ) : null}

          {usesNetwork ? (
            <section
              aria-label="Office internet"
              className="grid gap-3 border-brand-border/70 border-t pt-5"
            >
              <div>
                <h3 className={FIELD_LABEL}>Office internet addresses</h3>
                <p className={`${FIELD_HINT} mt-0.5`}>
                  Ask IT for the office's public internet address. Add one for each connection.
                </p>
              </div>
              <ul className="grid gap-4">
                {draft.networks.map((entry, index) => (
                  <AddressRow
                    entry={entry}
                    index={index}
                    key={entry.key}
                    onChange={settings.updateAddress}
                    onRemove={settings.removeAddress}
                  />
                ))}
              </ul>
              <div>
                <button
                  className="portal-small-btn"
                  disabled={draft.networks.length >= MAX_NETWORK_ENTRIES}
                  onClick={settings.addAddress}
                  type="button"
                >
                  Add address
                </button>
              </div>
            </section>
          ) : null}

          <details className="group border-brand-border/70 border-t pt-4">
            <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1.5 font-medium text-brand-dark text-sm [&::-webkit-details-marker]:hidden">
              <ChevronRight
                aria-hidden="true"
                className="size-4 text-brand-muted transition-transform group-open:rotate-90"
              />
              Advanced settings
            </summary>
            <div className="mt-3 grid gap-5 ps-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  hint="Location readings less precise than this are marked uncertain."
                  inputMode="numeric"
                  label="Accuracy limit (metres)"
                  onChange={(accuracy) => settings.update({ accuracy })}
                  value={draft.accuracy}
                />
                <TextField
                  hint="Sets the work date and the times people see."
                  label="Time zone"
                  onChange={(timeZone) => settings.update({ timeZone })}
                  placeholder="Asia/Kolkata"
                  value={draft.timeZone}
                />
              </div>
              {usesNetwork && addresses.length > 0 ? (
                <fieldset className="grid gap-2">
                  <legend className={`${FIELD_LABEL} mb-1`}>Address types</legend>
                  <p className={FIELD_HINT}>
                    Only “Office only” addresses can pass. Addresses shared with VPN users stay
                    uncertain.
                  </p>
                  {addresses.map((entry, index) => (
                    <AddressKindRow
                      entry={entry}
                      index={index}
                      key={entry.key}
                      onChange={settings.updateAddress}
                    />
                  ))}
                </fieldset>
              ) : null}
              <ModeField
                mode={draft.mode}
                onChange={(mode) => settings.update({ mode })}
                savedMode={settings.savedMode}
              />
            </div>
          </details>

          <div className="grid gap-1.5 border-brand-border/70 border-t pt-5">
            <label className={FIELD_LABEL} htmlFor={reasonId}>
              Reason for the change
            </label>
            <input
              aria-describedby={`${reasonId}-hint`}
              className={INPUT}
              id={reasonId}
              maxLength={500}
              onChange={setReason}
              value={draft.reason}
            />
            <p className={FIELD_HINT} id={`${reasonId}-hint`}>
              Saved in the history with your name.
            </p>
          </div>

          {settings.problems.length > 0 ? (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm"
              ref={problemsRef}
              role="alert"
              tabIndex={-1}
            >
              <p className="font-medium">Fix these before saving:</p>
              <ul className="mt-1 list-disc ps-5">
                {settings.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <ServerError message={settings.serverError} />
        </div>
      </DialogBody>
      <DialogFooter>
        <ControlledDialogClose
          className="portal-outline-btn"
          disabled={settings.saving}
          type="button"
        >
          Cancel
        </ControlledDialogClose>
        <button
          aria-busy={settings.saving || undefined}
          className="portal-primary-btn"
          disabled={settings.saving}
          type="submit"
        >
          {settings.saving ? "Saving…" : "Save"}
        </button>
      </DialogFooter>
    </form>
  );
}

/** Edits one office's check in a focused dialog. Remounts per office and saved version. */
export function OfficeSettingsDialog({
  office,
  onClose,
}: {
  office: OverviewOffice | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <OfficeDialog busy={busy} onClose={onClose} open={Boolean(office)} size="lg">
      {office ? (
        <OfficeSettingsForm
          key={`${office.id}:${office.rule?.version ?? 0}`}
          office={office}
          onBusyChange={setBusy}
          onDone={onClose}
        />
      ) : null}
    </OfficeDialog>
  );
}
