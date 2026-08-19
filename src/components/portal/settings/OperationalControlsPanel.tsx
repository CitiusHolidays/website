// biome-ignore-all lint/performance/noJsxPropsBind: React Compiler memoizes control handlers that intentionally close over the current revision and signed test session.
"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { FlaskConical, Info, RotateCcw, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { usePortalToast } from "@/components/portal/PortalToast";
import { PortalTooltip } from "@/components/portal/PortalTooltip";
import TurnstileWidget from "@/components/ui/TurnstileWidget";
import { cn } from "@/lib/utils";
import { formatConvexError } from "../workspace/portalWorkspaceListHelpers";
import {
  defaultTestOverrides,
  OPERATIONAL_TEST_SCOPE_KEYS,
  OPERATIONAL_TEST_SCOPE_LABELS,
  type OperationalControlDuration,
  type OperationalControlKey,
  type OperationalControlRow,
  type OperationalTestScope,
  operationalControlExpiry,
} from "./operationalControlViewModel";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const MINIMUM_REASON_LENGTH = 8;
const INDIA_DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

interface ActiveTestSession {
  expiresAt: number;
  sessionId: Id<"operationalControlTestSessions">;
  token: string;
}

interface InboundTestResult {
  accepted: boolean;
  duplicate: boolean;
  effects?: {
    crmIntake: string;
    infoMailboxEmail: string;
    salesBell: string;
    salesEmail: string;
  };
  intentId?: string | null;
}

function formatTimestamp(value?: number) {
  return value ? INDIA_DATE_TIME_FORMAT.format(value) : "—";
}

function ScopeTooltip({ kind }: { kind: "global" | "test" }) {
  const content =
    kind === "global"
      ? "Global controls change normal Production traffic for every visitor until reset or expired."
      : "A test override lasts 30 minutes and applies only to requests carrying its signed synthetic-test capability. Normal visitors are unchanged.";
  return (
    <PortalTooltip content={content}>
      <button
        aria-label={`Explain ${kind} operational controls`}
        className="inline-flex size-8 items-center justify-center rounded-full text-brand-muted hover:bg-brand-light hover:text-brand-dark"
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
        "relative h-7 w-12 shrink-0 rounded-full border transition-colors",
        checked ? "border-citius-blue bg-citius-blue" : "border-brand-border bg-brand-light",
        disabled && "cursor-not-allowed opacity-45"
      )}
      disabled={disabled}
      onClick={onChange}
      role="switch"
      type="button"
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

function ControlStatus({ control }: { control: OperationalControlRow }) {
  if (control.availability === "unavailable") {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-900 text-xs">
        Unavailable
      </span>
    );
  }
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 font-medium text-xs",
        control.effectiveEnabled ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700"
      )}
    >
      {control.effectiveEnabled ? "On" : "Off"}
    </span>
  );
}

function testOverrideButtonClass(selected: boolean, state: "enabled" | "disabled") {
  if (!selected) {
    return "text-brand-muted";
  }
  return state === "enabled" ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-800";
}

export function OperationalControlsPanel() {
  const toast = usePortalToast();
  const [queryAt] = useState(() => Date.now());
  const controls = useQuery(api.crm.settings.listOperationalControls, { at: queryAt });
  const activeOverrides = useQuery(api.crm.settings.listOperationalTestOverrides, { at: queryAt });
  const audit = useQuery(api.crm.settings.listOperationalControlAudit, {
    paginationOpts: { cursor: null, numItems: 8 },
  });
  const receipts = useQuery(api.crm.settings.listOperationalEffectReceipts, {
    paginationOpts: { cursor: null, numItems: 8 },
  });
  const sacredBharatMetrics = useQuery(
    api.sacredBharatEditionEvents.getEdition001AttributionMetrics,
    {
      edition: "001",
      from: queryAt - 30 * 24 * 60 * 60 * 1000,
      to: queryAt,
    }
  );
  const setControl = useMutation(api.crm.settings.setOperationalControl);
  const createTestOverride = useMutation(api.crm.settings.createOperationalTestOverride);
  const revokeTestOverride = useMutation(api.crm.settings.revokeOperationalTestOverride);
  const [globalReason, setGlobalReason] = useState("");
  const [duration, setDuration] = useState<OperationalControlDuration>("permanent");
  const [pendingControl, setPendingControl] = useState<OperationalControlKey | null>(null);
  const [testScope, setTestScope] = useState<OperationalTestScope>("inbound_contact");
  const [testReason, setTestReason] = useState("Verify CRM intake without outbound email");
  const [testOverrides, setTestOverrides] = useState(() =>
    defaultTestOverrides("inbound_contact", [])
  );
  const [activeTest, setActiveTest] = useState<ActiveTestSession | null>(null);
  const [testSubmitting, setTestSubmitting] = useState(false);
  const [inboundResult, setInboundResult] = useState<InboundTestResult | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileGeneration, setTurnstileGeneration] = useState(0);

  const rows = useMemo(() => (controls ?? []) as OperationalControlRow[], [controls]);
  const groupedControls = useMemo(() => {
    const groups = new Map<string, OperationalControlRow[]>();
    for (const control of rows) {
      const group = groups.get(control.category) ?? [];
      group.push(control);
      groups.set(control.category, group);
    }
    return Array.from(groups.entries());
  }, [rows]);
  const controlsByKey = useMemo(
    () => new Map(rows.map((control) => [control.key, control])),
    [rows]
  );
  const testScopeAvailable = OPERATIONAL_TEST_SCOPE_KEYS[testScope].every(
    (key) => controlsByKey.get(key)?.availability === "available"
  );

  const changeGlobalControl = async (
    control: OperationalControlRow,
    state: "default" | "enabled" | "disabled"
  ) => {
    if (globalReason.trim().length < MINIMUM_REASON_LENGTH) {
      toast.error("Add a reason of at least 8 characters before changing Production traffic.");
      return;
    }
    setPendingControl(control.key);
    try {
      await setControl({
        commandId: crypto.randomUUID(),
        expectedRevision: control.revision,
        expiresAt: state === "default" ? null : operationalControlExpiry(duration),
        key: control.key,
        reason: globalReason.trim(),
        state,
      });
      toast.success(`${control.label} ${state === "default" ? "reset" : state}.`);
    } catch (error) {
      toast.error(
        formatConvexError(error, `Could not update ${control.label}. Refresh and retry.`)
      );
    } finally {
      setPendingControl(null);
    }
  };

  const changeTestScope = (scope: OperationalTestScope) => {
    setTestScope(scope);
    setTestOverrides(defaultTestOverrides(scope, rows));
    setActiveTest(null);
    setInboundResult(null);
  };

  const changeTestOverride = (key: OperationalControlKey, state: "enabled" | "disabled") => {
    setTestOverrides((current) =>
      current.map((override) => (override.key === key ? { ...override, state } : override))
    );
  };

  const startTest = async () => {
    if (testReason.trim().length < MINIMUM_REASON_LENGTH) {
      toast.error("Add a reason of at least 8 characters for the test session.");
      return;
    }
    if (!testScopeAvailable) {
      toast.error("That feature does not yet expose a safe synthetic test seam.");
      return;
    }
    setTestSubmitting(true);
    try {
      const result = await createTestOverride({
        commandId: crypto.randomUUID(),
        overrides: testOverrides,
        reason: testReason.trim(),
        scope: testScope,
      });
      setActiveTest({
        expiresAt: result.expiresAt,
        sessionId: result.sessionId,
        token: result.token,
      });
      setInboundResult(null);
      toast.success("Signed 30-minute test session created. Normal traffic is unchanged.");
    } catch (error) {
      toast.error(formatConvexError(error, "Could not create the test session."));
    } finally {
      setTestSubmitting(false);
    }
  };

  const revokeTest = async () => {
    if (!activeTest) {
      return;
    }
    setTestSubmitting(true);
    try {
      await revokeTestOverride({
        commandId: crypto.randomUUID(),
        reason: "Admin ended synthetic test session",
        sessionId: activeTest.sessionId,
      });
      setActiveTest(null);
      setInboundResult(null);
      toast.success("Test session revoked.");
    } catch (error) {
      toast.error(formatConvexError(error, "Could not revoke the test session."));
    } finally {
      setTestSubmitting(false);
    }
  };

  const runInboundTest = async () => {
    if (!activeTest) {
      return;
    }
    setTestSubmitting(true);
    setInboundResult(null);
    try {
      const response = await fetch("/api/inbound-intents", {
        body: JSON.stringify({
          clientName: `[TEST] Operational control ${new Date().toISOString()}`,
          company: "",
          consent: true,
          contactEmail: "operational-test@citius.invalid",
          destination: "Synthetic CRM intake verification",
          formLoadedAt: Date.now() - 4000,
          notes: "Admin-created synthetic lead. Do not contact.",
          operationalTestToken: activeTest.token,
          source: "Website",
          synthetic: true,
          turnstileToken: turnstileToken || undefined,
        }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `operational-test-${crypto.randomUUID()}`,
        },
        method: "POST",
      });
      const result = (await response.json()) as InboundTestResult & { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Synthetic inbound test failed.");
      }
      setInboundResult(result);
      toast.success("Synthetic contact submission completed. Review the effect receipts below.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Synthetic inbound test failed.");
    } finally {
      setTurnstileToken("");
      setTurnstileGeneration((value) => value + 1);
      setTestSubmitting(false);
    }
  };

  if (controls === undefined) {
    return (
      <section
        className="rounded-lg border border-brand-border bg-white p-5 shadow-sm"
        role="status"
      >
        Loading Production controls…
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-brand-border bg-white shadow-sm">
      <div className="border-brand-border border-b bg-brand-dark px-5 py-5 text-white md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-white/70 text-xs uppercase tracking-[0.18em]">
              <ShieldCheck aria-hidden="true" className="size-4" />
              Exact Admin only
            </div>
            <h2 className="mt-2 font-heading font-semibold text-xl md:text-2xl">
              Production operational controls
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-white/75">
              Pause individual customer-facing features, CRM notifications, and email effects
              without changing unrelated traffic. Every change is revision-checked and audited.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 pr-1 pl-3">
              Global
              <ScopeTooltip kind="global" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 pr-1 pl-3">
              30-minute test
              <ScopeTooltip kind="test" />
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-8 p-5 md:p-6">
        <div className="grid gap-4 rounded-lg border border-brand-border bg-brand-light/60 p-4 md:grid-cols-[1fr_13rem]">
          <label className="text-brand-dark text-sm">
            <span className="font-semibold">Reason for global change</span>
            <input
              className="portal-input mt-2 w-full"
              maxLength={500}
              onChange={(event) => setGlobalReason(event.target.value)}
              placeholder="Required for the audit log"
              value={globalReason}
            />
          </label>
          <label className="text-brand-dark text-sm">
            <span className="font-semibold">Automatic reset</span>
            <select
              className="portal-input mt-2 w-full"
              onChange={(event) => setDuration(event.target.value as OperationalControlDuration)}
              value={duration}
            >
              <option value="permanent">No expiry</option>
              <option value="30m">After 30 minutes</option>
              <option value="2h">After 2 hours</option>
              <option value="24h">After 24 hours</option>
            </select>
          </label>
        </div>

        <div className="space-y-7">
          {groupedControls.map(([category, categoryControls]) => (
            <div key={category}>
              <h3 className="mb-3 font-heading font-semibold text-brand-dark text-lg">
                {category}
              </h3>
              <div className="divide-y divide-brand-border overflow-hidden rounded-lg border border-brand-border">
                {categoryControls.map((control) => {
                  const available = control.availability === "available";
                  const pending = pendingControl === control.key;
                  return (
                    <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto]" key={control.key}>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-brand-dark text-sm">{control.label}</h4>
                          <ControlStatus control={control} />
                          <span className="font-mono text-[11px] text-brand-muted">
                            {control.key}
                          </span>
                        </div>
                        <p className="mt-1 max-w-3xl text-brand-muted text-sm">
                          {control.description}
                        </p>
                        <p className="mt-2 text-brand-muted text-xs">
                          Enforced at {control.enforcement}. Source: {control.source}.
                          {control.dependencies.length > 0
                            ? ` Requires ${control.dependencies.join(", ")}.`
                            : ""}
                          {control.updatedByName
                            ? ` Last changed by ${control.updatedByName} on ${formatTimestamp(control.updatedAt)}.`
                            : ""}
                          {control.expiresAt
                            ? ` Resets after ${formatTimestamp(control.expiresAt)}.`
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
                          disabled={!available || pending}
                          onClick={() => changeGlobalControl(control, "default")}
                          type="button"
                        >
                          <RotateCcw aria-hidden="true" className="size-3.5" />
                          Reset
                        </button>
                        <ControlSwitch
                          checked={control.effectiveEnabled === true}
                          disabled={!available || pending}
                          label={control.label}
                          onChange={() =>
                            changeGlobalControl(
                              control,
                              control.effectiveEnabled ? "disabled" : "enabled"
                            )
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-citius-blue/25 bg-citius-blue/[0.035] p-4 md:p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-citius-blue/10 text-citius-blue">
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
                lead while suppressing bell and email side effects.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-brand-dark text-sm">
              <span className="font-semibold">Test surface</span>
              <select
                className="portal-input mt-2 w-full"
                onChange={(event) => changeTestScope(event.target.value as OperationalTestScope)}
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
                className="portal-input mt-2 w-full"
                maxLength={500}
                onChange={(event) => setTestReason(event.target.value)}
                value={testReason}
              />
            </label>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {testOverrides.map((override) => {
              const control = controlsByKey.get(override.key);
              return (
                <div
                  className="flex items-center justify-between gap-3 rounded-lg border border-brand-border bg-white p-3"
                  key={override.key}
                >
                  <span className="text-brand-dark text-sm">{control?.label ?? override.key}</span>
                  <div className="inline-flex rounded-md border border-brand-border p-0.5">
                    {(["enabled", "disabled"] as const).map((state) => (
                      <button
                        aria-pressed={override.state === state}
                        className={cn(
                          "min-h-9 rounded px-3 font-medium text-xs",
                          testOverrideButtonClass(override.state === state, state)
                        )}
                        key={state}
                        onClick={() => changeTestOverride(override.key, state)}
                        type="button"
                      >
                        {state === "enabled" ? "On" : "Off"}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {testScopeAvailable ? null : (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-amber-900 text-sm">
              This surface is catalogued but not testable until it has one reversible execution
              seam.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              className="portal-primary-btn min-h-11"
              disabled={testSubmitting || !testScopeAvailable}
              onClick={startTest}
              type="button"
            >
              {testSubmitting ? "Working…" : "Start 30-minute test"}
            </button>
            {activeTest ? (
              <>
                <span className="text-brand-muted text-sm" role="status">
                  Signed session active until {formatTimestamp(activeTest.expiresAt)}. Token is kept
                  only in this tab.
                </span>
                <button
                  className="portal-small-btn min-h-11"
                  disabled={testSubmitting}
                  onClick={revokeTest}
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
                Sends the normal Website form shape and creates a visibly marked synthetic CRM row.
                The result reports each independent effect.
              </p>
              {TURNSTILE_SITE_KEY ? (
                <div className="mt-3">
                  <TurnstileWidget
                    key={turnstileGeneration}
                    onError={() => setTurnstileToken("")}
                    onExpire={() => setTurnstileToken("")}
                    onVerify={setTurnstileToken}
                    siteKey={TURNSTILE_SITE_KEY}
                  />
                </div>
              ) : null}
              <button
                className="portal-primary-btn mt-3 min-h-11"
                disabled={testSubmitting || Boolean(TURNSTILE_SITE_KEY && !turnstileToken)}
                onClick={runInboundTest}
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

        <div className="grid gap-5 xl:grid-cols-2">
          <div>
            <h3 className="font-heading font-semibold text-brand-dark text-lg">Recent audit</h3>
            <div className="mt-2 divide-y divide-brand-border overflow-hidden rounded-lg border border-brand-border">
              {audit?.page.length ? (
                audit.page.map((entry) => (
                  <div className="p-3 text-sm" key={String(entry._id)}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-brand-dark">{entry.action}</span>
                      <span className="text-brand-muted text-xs">
                        {formatTimestamp(entry.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-brand-muted">
                      {entry.actorName}: {entry.reason}
                    </p>
                  </div>
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
              {receipts?.page.length ? (
                receipts.page.map((entry) => (
                  <div className="p-3 text-sm" key={String(entry._id)}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-brand-dark">{entry.controlKey}</span>
                      <span className="text-brand-muted text-xs">
                        {formatTimestamp(entry.createdAt)}
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
            <div>
              <p className="font-semibold text-citius-orange text-xs uppercase tracking-[0.16em]">
                Last 30 days
              </p>
              <h3 className="mt-1 font-heading font-semibold text-brand-dark text-lg">
                Sacred Bharat / 001 attributed replay loop
              </h3>
            </div>
            {sacredBharatMetrics?.truncated ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900 text-xs">
                Bounded result truncated
              </span>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Anonymous players", sacredBharatMetrics?.anonymousPlayers],
              ["Starts", sacredBharatMetrics?.eventCounts.challenge_started],
              ["Completions", sacredBharatMetrics?.eventCounts.challenge_completed],
              ["Friend-attributed starts", sacredBharatMetrics?.attributedStarts],
              ["Friend-attributed completions", sacredBharatMetrics?.attributedCompletions],
            ].map(([label, value]) => (
              <div className="rounded-lg border border-brand-border bg-white p-3" key={label}>
                <p className="font-heading font-semibold text-2xl text-brand-dark">
                  {value ?? "—"}
                </p>
                <p className="mt-1 text-brand-muted text-xs">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-brand-muted text-xs">
            Player, share, and referrer tokens are distinct and hashed at rest. These aggregates are
            separate from consented CRM attribution and contain no lead or traveller identity.
          </p>
        </div>

        {activeOverrides?.some((session) => session.revokedAt === undefined) ? (
          <p className="text-brand-muted text-xs">
            Other signed test sessions may be active. Each expires automatically after 30 minutes
            and cannot affect normal visitor traffic.
          </p>
        ) : null}
      </div>
    </section>
  );
}
