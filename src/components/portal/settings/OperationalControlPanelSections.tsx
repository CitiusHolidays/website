"use client";

import type { Id } from "@convex/_generated/dataModel";
import { CircleAlert, CircleCheck, FlaskConical, Info, RotateCcw } from "lucide-react";
import { type ChangeEvent, type Dispatch, type SetStateAction, useCallback } from "react";
import { PortalTooltip } from "@/components/portal/PortalTooltip";
import TurnstileWidget from "@/components/ui/TurnstileWidget";
import { cn } from "@/lib/utils";
import {
  type InboundTestResult,
  OPERATIONAL_CONTROL_DURATION_OPTIONS,
  OPERATIONAL_TEST_SCOPE_LABELS,
  type OperationalControlDuration,
  type OperationalControlKey,
  type OperationalControlPlaneStatus,
  type OperationalControlRow,
  type OperationalTestScope,
  operationalControlPlanePresentation,
  parseOperationalControlDuration,
  parseOperationalTestScope,
} from "./operationalControlViewModel";

const INDIA_DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

export interface ActiveTestSession {
  expiresAt: number;
  sessionId: Id<"operationalControlTestSessions">;
  token: string;
}

export interface OperationalAuditEntry {
  _id: Id<"operationalControlAuditEvents">;
  action: string;
  actorName: string;
  before?: { expiresAt?: number; state: string };
  controlKey?: string;
  createdAt: number;
  reason: string;
}

interface OperationalAuditResult {
  page: OperationalAuditEntry[];
}

interface OperationalReceiptResult {
  page: {
    _id: Id<"operationalEffectReceipts">;
    controlKey: string;
    createdAt: number;
    disposition: string;
    reason: string;
    synthetic: boolean;
  }[];
}

interface SacredBharatMetrics {
  anonymousPlayers: number;
  attributedCompletions: number;
  attributedResharers: number;
  attributedStarts: number;
  eventCounts: Partial<
    Record<
      "challenge_completed" | "challenge_started" | "edition_completed" | "edition_started",
      number
    >
  >;
  truncated: boolean;
}

export interface TestOverride {
  key: OperationalControlKey;
  state: "disabled" | "enabled";
}

function formatOperationalTimestamp(value?: number) {
  return value ? INDIA_DATE_TIME_FORMAT.format(value) : "—";
}

export function ScopeTooltip({ kind }: { kind: "global" | "test" }) {
  const content =
    kind === "global"
      ? "Global controls change normal Production traffic for every visitor until reset or expired."
      : "A test override lasts 30 minutes and applies only to requests carrying its signed synthetic-test capability. Normal visitors are unchanged.";
  return (
    <PortalTooltip content={content}>
      <button
        aria-label={`Explain ${kind} operational controls`}
        className="inline-flex size-11 items-center justify-center rounded-full text-brand-muted hover:bg-brand-light hover:text-brand-dark focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2"
        type="button"
      >
        <Info aria-hidden="true" className="size-4" />
      </button>
    </PortalTooltip>
  );
}

function ControlSwitch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={`${checked ? "Disable" : "Enable"} ${label}`}
      className={cn(
        "relative h-11 w-14 shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2",
        disabled && "cursor-not-allowed opacity-45"
      )}
      disabled={disabled}
      onClick={onChange}
      role="switch"
      type="button"
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-2 left-1 h-7 w-12 rounded-full border transition-colors",
          checked ? "border-citius-blue bg-citius-blue" : "border-brand-border bg-brand-light"
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-2.5 left-1.5 size-6 rounded-full bg-white shadow-sm transition-transform",
          checked && "translate-x-5"
        )}
      />
    </button>
  );
}

function ControlStatus({ active, control }: { active: boolean; control: OperationalControlRow }) {
  if (control.availability === "unavailable") {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-900 text-xs">
        Unavailable
      </span>
    );
  }
  const stateLabel = control.effectiveEnabled ? "On" : "Off";
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 font-medium text-xs",
        control.effectiveEnabled ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700"
      )}
    >
      {active ? stateLabel : `At activation: ${stateLabel}`}
    </span>
  );
}

export function OperationalControlPlaneBanner({
  activationPending,
  activationReason,
  onActivate,
  onActivationReasonChange,
  status,
}: {
  activationPending: boolean;
  activationReason: string;
  onActivate: () => void;
  onActivationReasonChange: (reason: string) => void;
  status: OperationalControlPlaneStatus | undefined;
}) {
  const handleActivationReasonChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onActivationReasonChange(event.target.value),
    [onActivationReasonChange]
  );
  if (!status) {
    return (
      <div
        className="rounded-xl border border-brand-border bg-brand-light/60 p-4 text-brand-muted text-sm"
        role="status"
      >
        Checking control-plane status…
      </div>
    );
  }

  const presentation = operationalControlPlanePresentation(status);
  const active = presentation.tone === "active";
  const blocked = presentation.tone === "blocked";
  return (
    <div
      className={cn(
        "rounded-xl border p-4 md:p-5",
        active && "border-emerald-200 bg-emerald-50",
        blocked && "border-red-200 bg-red-50",
        presentation.tone === "prepared" && "border-amber-200 bg-amber-50"
      )}
    >
      <div className="flex items-start gap-3">
        {active ? (
          <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-700" />
        ) : (
          <CircleAlert
            aria-hidden="true"
            className={cn("mt-0.5 size-5 shrink-0", blocked ? "text-red-700" : "text-amber-700")}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-heading font-semibold text-brand-dark text-lg">
              Control plane {presentation.label.toLowerCase()}
            </h3>
            <span className="font-mono text-brand-muted text-xs">Revision {status.revision}</span>
          </div>
          <p className="mt-1 text-brand-muted text-sm">{presentation.message}</p>
          {active ? (
            <p className="mt-2 text-emerald-900 text-xs">
              Activated by {status.activatedByName || "an Admin"} on{" "}
              {formatOperationalTimestamp(status.activatedAt)}. Activation is permanent; individual
              controls remain reversible and audited.
            </p>
          ) : null}
          {blocked && status.blockingKeys.length > 0 ? (
            <p className="mt-2 text-red-900 text-xs">
              Blocking state: {status.blockingKeys.join(", ")}
            </p>
          ) : null}
          {!active && status.ready ? (
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <label className="text-brand-dark text-sm">
                <span className="font-semibold">Activation reason</span>
                <input
                  className="portal-input mt-2 min-h-11 w-full"
                  maxLength={500}
                  onChange={handleActivationReasonChange}
                  placeholder="Required for the permanent activation audit"
                  value={activationReason}
                />
              </label>
              <button
                className="portal-primary-btn min-h-11"
                disabled={activationPending || activationReason.trim().length < 8}
                onClick={onActivate}
                type="button"
              >
                {activationPending ? "Activating…" : "Activate control plane once"}
              </button>
              <p className="text-brand-muted text-xs md:col-span-2">
                This one-way step initializes {status.willInitializeKeys.length} prepared controls
                at their reviewed standard behavior:{" "}
                {status.willInitializeKeys.join(", ") || "none"}.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function OperationalControlRowItem({
  active,
  control,
  onControlChange,
  pending,
}: {
  active: boolean;
  control: OperationalControlRow;
  onControlChange: (
    control: OperationalControlRow,
    state: "default" | "disabled" | "enabled"
  ) => void;
  pending: boolean;
}) {
  const available = control.availability === "available";
  const disabled = !available || pending;
  const resetControl = useCallback(
    () => onControlChange(control, "default"),
    [control, onControlChange]
  );
  const toggleControl = useCallback(
    () => onControlChange(control, control.effectiveEnabled ? "disabled" : "enabled"),
    [control, onControlChange]
  );
  return (
    <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-semibold text-brand-dark text-sm">{control.label}</h4>
          <ControlStatus active={active} control={control} />
          <span className="font-mono text-[11px] text-brand-muted">{control.key}</span>
        </div>
        <p className="mt-1 max-w-3xl text-brand-muted text-sm">{control.description}</p>
        <p className="mt-2 text-brand-muted text-xs">
          Enforced at {control.enforcement}. Source: {control.source}.
          {control.dependencies.length > 0 ? ` Requires ${control.dependencies.join(", ")}.` : ""}
          {control.updatedByName
            ? ` Last changed by ${control.updatedByName} on ${formatOperationalTimestamp(control.updatedAt)}.`
            : ""}
          {control.expiresAt
            ? ` Resets after ${formatOperationalTimestamp(control.expiresAt)}.`
            : ""}
        </p>
        {control.unavailableReason ? (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-amber-900 text-xs">
            {control.unavailableReason}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2 self-center">
        <button
          aria-label={`Reset ${control.label} to its standard behavior`}
          className="portal-small-btn inline-flex min-h-11 items-center gap-1.5"
          disabled={disabled}
          onClick={resetControl}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Reset
        </button>
        <ControlSwitch
          checked={control.effectiveEnabled === true}
          disabled={disabled}
          label={control.label}
          onChange={toggleControl}
        />
      </div>
    </div>
  );
}

export function OperationalControlCatalog({
  active,
  duration,
  globalReason,
  groupedControls,
  onControlChange,
  onDurationChange,
  onReasonChange,
  pendingControl,
}: {
  active: boolean;
  duration: OperationalControlDuration;
  globalReason: string;
  groupedControls: [string, OperationalControlRow[]][];
  onControlChange: (
    control: OperationalControlRow,
    state: "default" | "disabled" | "enabled"
  ) => void;
  onDurationChange: Dispatch<SetStateAction<OperationalControlDuration>>;
  onReasonChange: Dispatch<SetStateAction<string>>;
  pendingControl: OperationalControlKey | null;
}) {
  const handleReasonChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onReasonChange(event.target.value),
    [onReasonChange]
  );
  const handleDurationChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextDuration = parseOperationalControlDuration(event.target.value);
      if (nextDuration) {
        onDurationChange(nextDuration);
      }
    },
    [onDurationChange]
  );
  return (
    <>
      <div className="grid gap-4 rounded-lg border border-brand-border bg-brand-light/60 p-4 md:grid-cols-[1fr_13rem]">
        <label className="text-brand-dark text-sm">
          <span className="font-semibold">Reason for global change</span>
          <input
            className="portal-input mt-2 min-h-11 w-full"
            maxLength={500}
            onChange={handleReasonChange}
            placeholder="Required for the audit log"
            value={globalReason}
          />
        </label>
        <label className="text-brand-dark text-sm">
          <span className="font-semibold">Automatic reset</span>
          <select
            className="portal-input mt-2 min-h-11 w-full"
            disabled={!active}
            onChange={handleDurationChange}
            value={duration}
          >
            {OPERATIONAL_CONTROL_DURATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-7">
        {groupedControls.map(([category, categoryControls]) => (
          <div key={category}>
            <h3 className="mb-3 font-heading font-semibold text-brand-dark text-lg">{category}</h3>
            <div className="divide-y divide-brand-border overflow-hidden rounded-lg border border-brand-border">
              {categoryControls.map((control) => (
                <OperationalControlRowItem
                  active={active}
                  control={control}
                  key={control.key}
                  onControlChange={onControlChange}
                  pending={pendingControl === control.key}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function testOverrideButtonClass(selected: boolean, state: "enabled" | "disabled") {
  if (!selected) {
    return "text-brand-muted";
  }
  return state === "enabled" ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-800";
}

function TestOverrideRow({
  control,
  onOverrideChange,
  override,
}: {
  control: OperationalControlRow | undefined;
  onOverrideChange: (key: OperationalControlKey, state: "enabled" | "disabled") => void;
  override: TestOverride;
}) {
  const enable = useCallback(
    () => onOverrideChange(override.key, "enabled"),
    [onOverrideChange, override.key]
  );
  const disable = useCallback(
    () => onOverrideChange(override.key, "disabled"),
    [onOverrideChange, override.key]
  );
  const intakeRequired = override.key === "inbound.crm_intake";
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-brand-border bg-white p-3">
      <span className="text-brand-dark text-sm">
        {control?.label ?? override.key}
        {intakeRequired ? (
          <span className="mt-0.5 block text-brand-muted text-xs">
            Required so every synthetic test proves durable CRM intake.
          </span>
        ) : null}
      </span>
      {intakeRequired ? (
        <span className="inline-flex min-h-11 items-center rounded-md bg-emerald-100 px-3 font-medium text-emerald-900 text-xs">
          On · required
        </span>
      ) : (
        <div className="inline-flex rounded-md border border-brand-border p-0.5">
          <button
            aria-pressed={override.state === "enabled"}
            className={cn(
              "min-h-11 rounded px-3 font-medium text-xs",
              testOverrideButtonClass(override.state === "enabled", "enabled")
            )}
            onClick={enable}
            type="button"
          >
            On
          </button>
          <button
            aria-pressed={override.state === "disabled"}
            className={cn(
              "min-h-11 rounded px-3 font-medium text-xs",
              testOverrideButtonClass(override.state === "disabled", "disabled")
            )}
            onClick={disable}
            type="button"
          >
            Off
          </button>
        </div>
      )}
    </div>
  );
}

export function OperationalTestSection({
  active,
  activeTest,
  controlsByKey,
  inboundResult,
  onEndTest,
  onOverrideChange,
  onRunInboundTest,
  onStartTest,
  onTestReasonChange,
  onTestScopeChange,
  onTurnstileToken,
  testOverrides,
  testReason,
  testScope,
  testScopeAvailable,
  testSubmitting,
  turnstileGeneration,
  turnstileToken,
  turnstileSiteKey,
}: {
  active: boolean;
  activeTest: ActiveTestSession | null;
  controlsByKey: Map<OperationalControlKey, OperationalControlRow>;
  inboundResult: InboundTestResult | null;
  onEndTest: () => void;
  onOverrideChange: (key: OperationalControlKey, state: "enabled" | "disabled") => void;
  onRunInboundTest: () => void;
  onStartTest: () => void;
  onTestReasonChange: Dispatch<SetStateAction<string>>;
  onTestScopeChange: (scope: OperationalTestScope) => void;
  onTurnstileToken: Dispatch<SetStateAction<string>>;
  testOverrides: TestOverride[];
  testReason: string;
  testScope: OperationalTestScope;
  testScopeAvailable: boolean;
  testSubmitting: boolean;
  turnstileGeneration: number;
  turnstileToken: string;
  turnstileSiteKey: string;
}) {
  const disabled = testSubmitting || !testScopeAvailable;
  const handleScopeChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextScope = parseOperationalTestScope(event.target.value);
      if (nextScope) {
        onTestScopeChange(nextScope);
      }
    },
    [onTestScopeChange]
  );
  const handleReasonChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onTestReasonChange(event.target.value),
    [onTestReasonChange]
  );
  const clearTurnstile = useCallback(() => onTurnstileToken(""), [onTurnstileToken]);
  return (
    <div className="rounded-xl border border-citius-blue/25 bg-citius-blue/[0.035] p-4 md:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-citius-blue/10 text-citius-blue">
          <FlaskConical aria-hidden="true" className="size-5" />
        </span>
        <div>
          <div className="flex items-center gap-1">
            <h3 className="font-heading font-semibold text-brand-dark text-lg">
              Isolated test override
            </h3>
            <ScopeTooltip kind="test" />
          </div>
          <p className="text-brand-muted text-sm">
            Create a signed 30-minute session. The default inbound recipe stores a synthetic CRM
            lead while suppressing bell and email side effects. This rehearsal is available before
            the control plane is activated; {active ? "live" : "prepared"} Global settings are not
            changed.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-brand-dark text-sm">
          <span className="font-semibold">Test surface</span>
          <select
            className="portal-input mt-2 min-h-11 w-full"
            onChange={handleScopeChange}
            value={testScope}
          >
            {Object.entries(OPERATIONAL_TEST_SCOPE_LABELS).map(([scope, label]) => (
              <option key={scope} value={scope}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-brand-dark text-sm">
          <span className="font-semibold">Test reason</span>
          <input
            className="portal-input mt-2 min-h-11 w-full"
            maxLength={500}
            onChange={handleReasonChange}
            value={testReason}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {testOverrides.map((override) => (
          <TestOverrideRow
            control={controlsByKey.get(override.key)}
            key={override.key}
            onOverrideChange={onOverrideChange}
            override={override}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          className="portal-primary-btn min-h-11"
          disabled={disabled}
          onClick={onStartTest}
          type="button"
        >
          {testSubmitting ? "Working…" : "Start 30-minute test"}
        </button>
        {activeTest ? (
          <>
            <span className="text-brand-muted text-sm" role="status">
              Signed session active until {formatOperationalTimestamp(activeTest.expiresAt)}. Token
              is kept only in this tab.
            </span>
            <button
              className="portal-small-btn min-h-11"
              disabled={testSubmitting}
              onClick={onEndTest}
              type="button"
            >
              End test
            </button>
          </>
        ) : null}
      </div>

      {activeTest && testScope === "inbound_contact" ? (
        <div className="mt-4 rounded-lg border border-brand-border bg-white p-4">
          <h4 className="font-semibold text-brand-dark text-sm">Synthetic contact test</h4>
          <p className="mt-1 text-brand-muted text-sm">
            Sends the normal Website form shape and creates a visibly marked synthetic CRM row. The
            result reports each independent effect.
          </p>
          {turnstileSiteKey ? (
            <div className="mt-3">
              <TurnstileWidget
                key={turnstileGeneration}
                onError={clearTurnstile}
                onExpire={clearTurnstile}
                onVerify={onTurnstileToken}
                siteKey={turnstileSiteKey}
              />
            </div>
          ) : null}
          <button
            className="portal-primary-btn mt-3 min-h-11"
            disabled={testSubmitting || Boolean(turnstileSiteKey && !turnstileToken)}
            onClick={onRunInboundTest}
            type="button"
          >
            Run test inbound lead
          </button>
          {inboundResult?.effects ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2" role="status">
              {Object.entries(inboundResult.effects).map(([effect, disposition]) => (
                <div className="rounded-md bg-brand-light px-3 py-2 text-sm" key={effect}>
                  <span className="font-medium text-brand-dark">{effect}</span>
                  <span className="ml-2 text-brand-muted">{disposition}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function OperationalAuditRow({
  entry,
  onRollback,
  pendingControl,
}: {
  entry: OperationalAuditEntry;
  onRollback: (entry: OperationalAuditEntry) => void;
  pendingControl: OperationalControlKey | null;
}) {
  const rollback = useCallback(() => onRollback(entry), [entry, onRollback]);
  return (
    <div className="p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="font-medium text-brand-dark">{entry.action}</span>
          <span className="ml-2 text-brand-muted text-xs">
            {formatOperationalTimestamp(entry.createdAt)}
          </span>
        </div>
        {entry.controlKey && entry.before ? (
          <button
            className="portal-small-btn min-h-11"
            disabled={pendingControl === entry.controlKey}
            onClick={rollback}
            type="button"
          >
            Roll back
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-brand-muted">
        {entry.actorName}: {entry.reason}
      </p>
    </div>
  );
}

export function OperationalEvidence({
  audit,
  metrics,
  onRollback,
  pendingControl,
  receipts,
}: {
  audit: OperationalAuditResult | undefined;
  metrics: SacredBharatMetrics | undefined;
  onRollback: (entry: OperationalAuditEntry) => void;
  pendingControl: OperationalControlKey | null;
  receipts: OperationalReceiptResult | undefined;
}) {
  const auditEntries = audit ? audit.page : [];
  const eventCounts = metrics ? metrics.eventCounts : {};
  const receiptEntries = receipts ? receipts.page : [];
  const completionCount = eventCounts.edition_completed ?? eventCounts.challenge_completed;
  const startCount = eventCounts.edition_started ?? eventCounts.challenge_started;

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-2">
        <div>
          <h3 className="font-heading font-semibold text-brand-dark text-lg">Recent audit</h3>
          <div className="mt-2 divide-y divide-brand-border overflow-hidden rounded-lg border border-brand-border">
            {auditEntries.length ? (
              auditEntries.map((entry) => (
                <OperationalAuditRow
                  entry={entry}
                  key={String(entry._id)}
                  onRollback={onRollback}
                  pendingControl={pendingControl}
                />
              ))
            ) : (
              <p className="p-3 text-brand-muted text-sm">No control changes yet.</p>
            )}
          </div>
        </div>
        <div>
          <h3 className="font-heading font-semibold text-brand-dark text-lg">
            Recent effect receipts
          </h3>
          <div className="mt-2 divide-y divide-brand-border overflow-hidden rounded-lg border border-brand-border">
            {receiptEntries.length ? (
              receiptEntries.map((entry) => (
                <div className="p-3 text-sm" key={String(entry._id)}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-brand-dark">{entry.controlKey}</span>
                    <span className="text-brand-muted text-xs">
                      {formatOperationalTimestamp(entry.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-brand-muted">
                    {entry.disposition} · {entry.reason}
                    {entry.synthetic ? " · synthetic" : ""}
                  </p>
                </div>
              ))
            ) : (
              <p className="p-3 text-brand-muted text-sm">No effect receipts yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-light/60 p-4 md:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="font-heading font-semibold text-brand-dark text-lg">
            Sacred Bharat / 001 attributed replay, last 30 days
          </h3>
          {metrics?.truncated ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900 text-xs">
              Bounded result truncated
            </span>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {[
            ["Anonymous players", metrics?.anonymousPlayers],
            ["Starts", startCount],
            ["Completions", completionCount],
            ["Friend-attributed starts", metrics?.attributedStarts],
            ["Friend-attributed completions", metrics?.attributedCompletions],
            ["Friend-attributed resharers", metrics?.attributedResharers],
          ].map(([label, value]) => (
            <div className="rounded-lg border border-brand-border bg-white p-3" key={label}>
              <p className="font-heading font-semibold text-2xl text-brand-dark">{value ?? "—"}</p>
              <p className="mt-1 text-brand-muted text-xs">{label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-brand-muted text-xs">
          Player, share, and referrer tokens are distinct and hashed at rest. These aggregates are
          separate from consented CRM attribution and contain no lead or traveller identity.
        </p>
      </div>
    </>
  );
}
