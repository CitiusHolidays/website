"use client";

import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { usePortalToast } from "@/components/portal/PortalToast";
import { formatConvexError } from "../workspace/portalWorkspaceListHelpers";
import {
  type ActiveTestSession,
  type InboundTestResult,
  type OperationalAuditEntry,
  OperationalControlCatalog,
  OperationalControlPlaneBanner,
  OperationalEvidence,
  OperationalTestSection,
  ScopeTooltip,
  type TestOverride,
} from "./OperationalControlPanelSections";
import {
  DEFAULT_OPERATIONAL_CONTROL_DURATION,
  defaultTestOverrides,
  OPERATIONAL_TEST_SCOPE_KEYS,
  type OperationalControlKey,
  type OperationalControlPlaneStatus,
  type OperationalControlRow,
  type OperationalTestScope,
  operationalControlExpiry,
} from "./operationalControlViewModel";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const MINIMUM_REASON_LENGTH = 8;

function useOperationalControlQueries(queryAt: number) {
  const controlPlaneStatus = useQuery(api.crm.settings.getOperationalControlPlaneStatus, {
    at: queryAt,
  });
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
  return {
    activeOverrides,
    audit,
    controlPlaneStatus,
    controls,
    receipts,
    sacredBharatMetrics,
  };
}

function useOperationalControlMutations() {
  return {
    activateControlPlane: useMutation(api.crm.settings.activateOperationalControlPlane),
    createTestOverride: useMutation(api.crm.settings.createOperationalTestOverride),
    revokeTestOverride: useMutation(api.crm.settings.revokeOperationalTestOverride),
    rollbackControl: useMutation(api.crm.settings.rollbackOperationalControl),
    setControl: useMutation(api.crm.settings.setOperationalControl),
  };
}

function useOperationalControlsPanel() {
  const toast = usePortalToast();
  const [queryAt] = useState(() => Date.now());
  const queries = useOperationalControlQueries(queryAt);
  const mutations = useOperationalControlMutations();
  const [activationReason, setActivationReason] = useState("");
  const [activationPending, setActivationPending] = useState(false);
  const [globalReason, setGlobalReason] = useState("");
  const [duration, setDuration] = useState(DEFAULT_OPERATIONAL_CONTROL_DURATION);
  const [pendingControl, setPendingControl] = useState<OperationalControlKey | null>(null);
  const [testScope, setTestScope] = useState<OperationalTestScope>("inbound_contact");
  const [testReason, setTestReason] = useState("Verify CRM intake without outbound email");
  const [testOverrides, setTestOverrides] = useState<TestOverride[]>(() =>
    defaultTestOverrides("inbound_contact", [])
  );
  const [activeTest, setActiveTest] = useState<ActiveTestSession | null>(null);
  const [testSubmitting, setTestSubmitting] = useState(false);
  const [inboundResult, setInboundResult] = useState<InboundTestResult | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileGeneration, setTurnstileGeneration] = useState(0);

  const rows = useMemo(
    () => (queries.controls ?? []) as OperationalControlRow[],
    [queries.controls]
  );
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
  const controlPlane = queries.controlPlaneStatus as OperationalControlPlaneStatus | undefined;
  const planeActive = controlPlane?.active === true;

  const activateControlPlane = async () => {
    if (!controlPlane?.ready) {
      toast.error("The control plane is not ready to activate.");
      return;
    }
    if (activationReason.trim().length < MINIMUM_REASON_LENGTH) {
      toast.error("Add a reason of at least 8 characters before permanent activation.");
      return;
    }
    setActivationPending(true);
    try {
      const result = await mutations.activateControlPlane({
        commandId: crypto.randomUUID(),
        expectedRevision: controlPlane.revision,
        reason: activationReason.trim(),
      });
      toast.success(
        `Control plane activated. ${result.initializedControlKeys.length} controls initialized atomically.`
      );
      setActivationReason("");
    } catch (error) {
      toast.error(
        formatConvexError(error, "Could not activate the control plane. Refresh and retry.")
      );
    } finally {
      setActivationPending(false);
    }
  };

  const changeGlobalControl = async (
    control: OperationalControlRow,
    state: "default" | "enabled" | "disabled"
  ) => {
    if (!planeActive) {
      toast.error("Activate the control plane before changing live traffic.");
      return;
    }
    if (globalReason.trim().length < MINIMUM_REASON_LENGTH) {
      toast.error("Add a reason of at least 8 characters before changing Production traffic.");
      return;
    }
    setPendingControl(control.key);
    try {
      await mutations.setControl({
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

  const rollbackAuditEntry = async (entry: OperationalAuditEntry) => {
    if (!(planeActive && entry.controlKey && entry.before)) {
      return;
    }
    if (globalReason.trim().length < MINIMUM_REASON_LENGTH) {
      toast.error("Add a reason of at least 8 characters before rolling back Production traffic.");
      return;
    }
    const control = controlsByKey.get(entry.controlKey as OperationalControlKey);
    if (!control) {
      toast.error("That control is no longer present in the catalog.");
      return;
    }
    setPendingControl(control.key);
    try {
      await mutations.rollbackControl({
        auditEventId: entry._id,
        commandId: crypto.randomUUID(),
        expectedRevision: control.revision,
        reason: `Rollback: ${globalReason.trim()}`.slice(0, 500),
      });
      toast.success(`${control.label} restored to its state before this audit event.`);
    } catch (error) {
      toast.error(
        formatConvexError(error, `Could not roll back ${control.label}. Refresh and retry.`)
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
    if (!planeActive) {
      toast.error("Activate the control plane before creating a test override.");
      return;
    }
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
      const result = await mutations.createTestOverride({
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
      await mutations.revokeTestOverride({
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

  return {
    ...queries,
    activateControlPlane,
    activationPending,
    activationReason,
    activeTest,
    changeGlobalControl,
    changeTestOverride,
    changeTestScope,
    controlPlane,
    controlsByKey,
    duration,
    globalReason,
    groupedControls,
    inboundResult,
    pendingControl,
    planeActive,
    revokeTest,
    rollbackAuditEntry,
    runInboundTest,
    setActivationReason,
    setDuration,
    setGlobalReason,
    setTestReason,
    setTurnstileToken,
    startTest,
    testOverrides,
    testReason,
    testScope,
    testScopeAvailable,
    testSubmitting,
    turnstileGeneration,
    turnstileToken,
  };
}

export function OperationalControlsPanel() {
  const panel = useOperationalControlsPanel();
  if (panel.controls === undefined) {
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
            <span className="inline-flex min-h-11 items-center gap-1 rounded-full bg-white/10 pr-1 pl-3">
              Global <ScopeTooltip kind="global" />
            </span>
            <span className="inline-flex min-h-11 items-center gap-1 rounded-full bg-white/10 pr-1 pl-3">
              30-minute test <ScopeTooltip kind="test" />
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-8 p-5 md:p-6">
        <OperationalControlPlaneBanner
          activationPending={panel.activationPending}
          activationReason={panel.activationReason}
          onActivate={panel.activateControlPlane}
          onActivationReasonChange={panel.setActivationReason}
          status={panel.controlPlane}
        />
        <OperationalControlCatalog
          active={panel.planeActive}
          duration={panel.duration}
          globalReason={panel.globalReason}
          groupedControls={panel.groupedControls}
          onControlChange={panel.changeGlobalControl}
          onDurationChange={panel.setDuration}
          onReasonChange={panel.setGlobalReason}
          pendingControl={panel.pendingControl}
        />
        <OperationalTestSection
          active={panel.planeActive}
          activeTest={panel.activeTest}
          controlsByKey={panel.controlsByKey}
          inboundResult={panel.inboundResult}
          onEndTest={panel.revokeTest}
          onOverrideChange={panel.changeTestOverride}
          onRunInboundTest={panel.runInboundTest}
          onStartTest={panel.startTest}
          onTestReasonChange={panel.setTestReason}
          onTestScopeChange={panel.changeTestScope}
          onTurnstileToken={panel.setTurnstileToken}
          testOverrides={panel.testOverrides}
          testReason={panel.testReason}
          testScope={panel.testScope}
          testScopeAvailable={panel.testScopeAvailable}
          testSubmitting={panel.testSubmitting}
          turnstileGeneration={panel.turnstileGeneration}
          turnstileSiteKey={TURNSTILE_SITE_KEY}
          turnstileToken={panel.turnstileToken}
        />
        <OperationalEvidence
          active={panel.planeActive}
          audit={panel.audit}
          metrics={panel.sacredBharatMetrics}
          onRollback={panel.rollbackAuditEntry}
          pendingControl={panel.pendingControl}
          receipts={panel.receipts}
        />
        {panel.activeOverrides?.some((session) => session.revokedAt === undefined) ? (
          <p className="text-brand-muted text-xs">
            Other signed test sessions may be active. Each expires automatically after 30 minutes
            and cannot affect normal visitor traffic.
          </p>
        ) : null}
      </div>
    </section>
  );
}
