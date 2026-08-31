"use client";

import { AnimatePresence, m, useIsPresent, useReducedMotion } from "motion/react";
import { useId, useRef, useState } from "react";
import {
  isInboundReceiptReference,
  normalizeInboundEnquiryBrief,
} from "@/lib/contact/inboundIntentContract";
import {
  describeSacredBharatIntentContext,
  normalizeSacredBharatIntentContext,
} from "@/lib/sacredBharat/inboundIntent";
import {
  formatContactSubmissionError,
  readJsonError,
  withSupportReference,
} from "@/lib/userFacingErrors";
import { isRuntimeString, propertiesWhen } from "../../lib/runtimeValues";
import { ChevronDownIcon, PhoneCallIcon, useAnimatedIconTrigger } from "./AnimatedLucideIcons";
import EnquiryBriefFields from "./EnquiryBriefFields";
import TurnstileWidget from "./TurnstileWidget";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

const CONCIERGE_HANDOFF_EASE = [0.22, 1, 0.36, 1];

export const CONCIERGE_HANDOFF_LAYOUT_SPRING = {
  damping: 33.161_255_787_892_26,
  stiffness: 304.617_419_786_708_64,
  type: "spring",
};

function briefDraft(form) {
  return {
    contactWindow: form.contactWindow,
    dateFlexibility: form.dateFlexibility,
    destination: form.destination,
    paxCount: form.paxCount,
    serviceType: form.serviceType,
    travelStartDate: form.travelStartDate,
  };
}

export function conciergeHandoffDisclosureMotion(shouldReduceMotion) {
  if (shouldReduceMotion) {
    return {
      animate: { opacity: 1, transform: "none" },
      exit: { opacity: 0, transform: "none" },
      initial: { opacity: 0, transform: "none" },
      transition: { duration: 0.18, ease: "linear" },
    };
  }
  return {
    animate: { opacity: 1, transform: "translateY(0)" },
    exit: { opacity: 0, transform: "translateY(-4px)" },
    initial: { opacity: 0, transform: "translateY(-4px)" },
    transition: { duration: 0.18, ease: CONCIERGE_HANDOFF_EASE },
  };
}

function HandoffFormPresence({ children, motion }) {
  const isPresent = useIsPresent();
  return (
    <m.div
      animate={motion.animate}
      aria-hidden={isPresent ? undefined : true}
      data-concierge-handoff-form=""
      exit={motion.exit}
      inert={isPresent ? undefined : true}
      initial={motion.initial}
      transition={motion.transition}
    >
      {children}
    </m.div>
  );
}

export function buildInboundHandoffPayload(
  form,
  formLoadedAt,
  turnstileToken,
  { sacredBharatContext, source }
) {
  const payload = {
    clientName: form.clientName.trim(),
    consent: form.consent === true,
    formLoadedAt,
    source,
  };
  const optional = {
    contactEmail: form.contactEmail.trim().toLowerCase(),
    contactMobile: form.contactMobile.trim(),
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value) {
      payload[key] = value;
    }
  }
  const brief = normalizeInboundEnquiryBrief(briefDraft(form), { allowPaxString: true });
  if (brief.ok && brief.value) {
    payload.brief = brief.value;
  }
  if (turnstileToken) {
    payload.turnstileToken = turnstileToken;
  }
  if (source === "Sacred Bharat") {
    const context = normalizeSacredBharatIntentContext(sacredBharatContext);
    if (context) {
      payload.sacredBharatContext = context;
    }
  }
  return payload;
}

export function buildConciergeHandoffPayload(form, formLoadedAt, turnstileToken) {
  return buildInboundHandoffPayload(form, formLoadedAt, turnstileToken, {
    source: "Citius Concierge",
  });
}

export function buildSacredBharatHandoffPayload(
  form,
  formLoadedAt,
  turnstileToken,
  sacredBharatContext
) {
  return buildInboundHandoffPayload(form, formLoadedAt, turnstileToken, {
    sacredBharatContext,
    source: "Sacred Bharat",
  });
}

function initialForm(initialBrief, destination = "", source = "Citius Concierge") {
  const normalizedBrief = normalizeInboundEnquiryBrief(initialBrief);
  const brief = normalizedBrief.ok ? (normalizedBrief.value ?? {}) : {};
  return {
    clientName: "",
    consent: false,
    contactEmail: "",
    contactMobile: "",
    contactWindow: brief.contactWindow ?? "",
    dateFlexibility: brief.dateFlexibility ?? "",
    destination: brief.destination ?? destination,
    paxCount: brief.paxCount === undefined ? "" : String(brief.paxCount),
    serviceType: brief.serviceType ?? (source === "Sacred Bharat" ? "pilgrimage" : ""),
    travelStartDate: brief.travelStartDate ?? "",
  };
}

function validateHandoffForm(form) {
  const errors = {};
  if (!form.clientName.trim()) {
    errors.clientName = "Name is required.";
  }
  if (!(form.contactEmail.trim() || form.contactMobile.trim())) {
    errors.contact = "Add an email or mobile number.";
  }
  if (!form.consent) {
    errors.consent = "Confirm that Citius may contact you.";
  }
  const brief = normalizeInboundEnquiryBrief(briefDraft(form), { allowPaxString: true });
  if (!brief.ok) {
    errors[brief.field || "brief"] = brief.error;
  }
  return errors;
}

function sacredSubmissionStorageKey(context) {
  if (context?.entryPoint === "journey_planner") {
    return `citius:sacred-intent:v1:journey-planner:${context.templeId}`;
  }
  return `citius:sacred-intent:v1:trail:${context?.trailSlug ?? "unknown"}`;
}

async function sacredSubmissionFingerprint(payload) {
  const {
    formLoadedAt: _formLoadedAt,
    turnstileToken: _turnstileToken,
    ...boundedPayload
  } = payload;
  if (!crypto.subtle) {
    return null;
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(boundedPayload))
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function replaySafeSacredSubmissionKey(context, payload) {
  const storageKey = sacredSubmissionStorageKey(context);
  const fingerprint = await sacredSubmissionFingerprint(payload);
  if (!fingerprint) {
    return crypto.randomUUID();
  }
  try {
    const existing = JSON.parse(window.sessionStorage.getItem(storageKey) || "null");
    if (existing?.fingerprint === fingerprint && isRuntimeString(existing.key)) {
      return existing.key;
    }
    const key = crypto.randomUUID();
    window.sessionStorage.setItem(storageKey, JSON.stringify({ fingerprint, key }));
    return key;
  } catch {
    return crypto.randomUUID();
  }
}

function clearSacredSubmissionKey(context, key) {
  const storageKey = sacredSubmissionStorageKey(context);
  try {
    const existing = JSON.parse(window.sessionStorage.getItem(storageKey) || "null");
    if (existing?.key === key) {
      window.sessionStorage.removeItem(storageKey);
    }
  } catch {
    // Storage can be unavailable in hardened browsers; server dedupe still covers in-page retry.
  }
}

async function sendInboundHandoff(payload, submissionKey) {
  try {
    const response = await fetch("/api/inbound-intents", {
      body: JSON.stringify(payload),
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": submissionKey,
      },
      method: "POST",
    });
    if (!response.ok) {
      return {
        message: withSupportReference(
          formatContactSubmissionError({
            message: await readJsonError(response),
            status: response.status,
          }),
          response
        ),
        ok: false,
      };
    }
    const result = await response.json();
    if (!isInboundReceiptReference(result?.receiptReference)) {
      return { message: formatContactSubmissionError(), ok: false };
    }
    return { ok: true, receiptReference: result.receiptReference };
  } catch {
    return { message: formatContactSubmissionError(), ok: false };
  }
}

function InboundHandoffForm({
  clearTurnstileToken,
  contextDescription,
  fieldIdPrefix,
  fieldErrors,
  form,
  formRef,
  formRegionId,
  isSacredBharat,
  privacyCopy: providedPrivacyCopy,
  status,
  submit,
  turnstileGeneration,
  updateField,
  verifyTurnstileToken,
}) {
  const privacyCopy =
    providedPrivacyCopy ??
    (isSacredBharat
      ? `Citius receives only the fields below and ${contextDescription?.label ?? "this Sacred Bharat selection"}. Your Soul Score, progress, wishlist, and AI journey text are not attached.`
      : "Citius receives only the fields below. Your Concierge conversation is not attached.");
  return (
    <form
      aria-busy={status.state === "sending"}
      className="mt-3 space-y-3"
      id={formRegionId}
      noValidate
      onSubmit={submit}
      ref={formRef}
    >
      <p className="text-brand-muted text-xs leading-5">{privacyCopy}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-brand-dark text-xs sm:col-span-2">
          Name
          <input
            aria-describedby={fieldErrors.clientName ? `${fieldIdPrefix}-name-error` : undefined}
            aria-invalid={fieldErrors.clientName ? "true" : "false"}
            autoComplete="name"
            className="mt-1 min-h-10 w-full rounded-lg border border-brand-border px-3 text-base sm:text-sm"
            maxLength={160}
            name="clientName"
            onChange={updateField}
            required
            value={form.clientName}
          />
          {fieldErrors.clientName ? (
            <span className="mt-1 block text-red-700" id={`${fieldIdPrefix}-name-error`}>
              {fieldErrors.clientName}
            </span>
          ) : null}
        </label>
        <label className="text-brand-dark text-xs">
          Email
          <input
            aria-describedby={fieldErrors.contact ? `${fieldIdPrefix}-contact-error` : undefined}
            aria-invalid={fieldErrors.contact ? "true" : "false"}
            autoComplete="email"
            className="mt-1 min-h-10 w-full rounded-lg border border-brand-border px-3 text-base sm:text-sm"
            maxLength={254}
            name="contactEmail"
            onChange={updateField}
            type="email"
            value={form.contactEmail}
          />
        </label>
        <label className="text-brand-dark text-xs">
          Mobile
          <input
            aria-describedby={fieldErrors.contact ? `${fieldIdPrefix}-contact-error` : undefined}
            aria-invalid={fieldErrors.contact ? "true" : "false"}
            autoComplete="tel"
            className="mt-1 min-h-10 w-full rounded-lg border border-brand-border px-3 text-base sm:text-sm"
            maxLength={50}
            name="contactMobile"
            onChange={updateField}
            type="tel"
            value={form.contactMobile}
          />
        </label>
        {fieldErrors.contact ? (
          <p className="text-red-700 text-xs sm:col-span-2" id={`${fieldIdPrefix}-contact-error`}>
            {fieldErrors.contact}
          </p>
        ) : null}
      </div>
      <EnquiryBriefFields
        brief={form}
        compact
        errors={fieldErrors}
        idPrefix={`${fieldIdPrefix}-brief`}
        onChange={updateField}
      />
      <label className="flex gap-2 text-brand-muted text-xs leading-5">
        <input
          aria-describedby={fieldErrors.consent ? `${fieldIdPrefix}-consent-error` : undefined}
          aria-invalid={fieldErrors.consent ? "true" : "false"}
          checked={form.consent}
          className="mt-1 size-4 shrink-0"
          name="consent"
          onChange={updateField}
          type="checkbox"
        />
        I agree that Citius Holidays may contact me about this travel request.
      </label>
      {fieldErrors.consent ? (
        <p className="text-red-700 text-xs" id={`${fieldIdPrefix}-consent-error`}>
          {fieldErrors.consent}
        </p>
      ) : null}
      {TURNSTILE_SITE_KEY ? (
        <TurnstileWidget
          key={turnstileGeneration}
          onError={clearTurnstileToken}
          onExpire={clearTurnstileToken}
          onVerify={verifyTurnstileToken}
          siteKey={TURNSTILE_SITE_KEY}
        />
      ) : null}
      <p
        aria-live="polite"
        className={`${
          status.state === "error" ? "text-red-700" : "text-brand-muted"
        } text-xs ${status.message ? "" : "sr-only"}`}
        role="status"
      >
        {status.message}
      </p>
      <button
        className="min-h-11 w-full rounded-xl bg-citius-blue px-4 font-medium text-sm text-white disabled:opacity-60"
        disabled={status.state === "sending"}
        type="submit"
      >
        {isSacredBharat ? "Send planning request" : "Send contact request"}
      </button>
    </form>
  );
}

function InboundContactHandoff({
  defaultExpanded = false,
  initialBrief,
  privacyCopy,
  sacredBharatContext,
  source,
  successMessage,
  triggerLabel,
}) {
  const contextDescription = describeSacredBharatIntentContext(sacredBharatContext);
  const isSacredBharat = source === "Sacred Bharat";
  const defaultDestination = contextDescription?.destination ?? "";
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState(() => initialForm(initialBrief, defaultDestination, source));
  const [status, setStatus] = useState({ message: "", state: "idle" });
  const [turnstileGeneration, setTurnstileGeneration] = useState(0);
  const shouldReduceMotion = !!useReducedMotion();
  const formRegionId = useId();
  const fieldIdPrefix = `${formRegionId}-field`;
  const formLoadedAt = useRef(defaultExpanded ? Date.now() : 0);
  const formRef = useRef(null);
  const chevronIconRef = useRef(null);
  const phoneIconRef = useRef(null);
  const triggerIconMotion = useAnimatedIconTrigger(phoneIconRef, chevronIconRef);
  const sending = useRef(false);
  const submissionKey = useRef("");
  const turnstileToken = useRef("");
  const disclosureMotion = conciergeHandoffDisclosureMotion(shouldReduceMotion);

  const toggleExpanded = () => {
    const nextExpanded = !expanded;
    if (nextExpanded) {
      formLoadedAt.current = Date.now();
      if (!(isSacredBharat || submissionKey.current)) {
        submissionKey.current = crypto.randomUUID();
      }
    }
    setExpanded(nextExpanded);
  };
  const updateField = (event) => {
    const { checked, name, type, value } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    setFieldErrors((current) => ({
      ...current,
      ...propertiesWhen(name === "contactEmail" || name === "contactMobile", () => ({
        contact: undefined,
      })),
      [name]: undefined,
    }));
  };
  const focusFirstError = (errors) => {
    const firstName = [
      "clientName",
      "contactEmail",
      "contactMobile",
      "serviceType",
      "destination",
      "travelStartDate",
      "dateFlexibility",
      "paxCount",
      "contactWindow",
      "consent",
    ].find((name) => errors[name] || (name === "contactEmail" && errors.contact));
    if (firstName) {
      requestAnimationFrame(() => formRef.current?.elements.namedItem(firstName)?.focus());
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    if (sending.current) {
      return;
    }
    const errors = validateHandoffForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setStatus({ message: "Please correct the highlighted fields.", state: "error" });
      focusFirstError(errors);
      return;
    }
    if (TURNSTILE_SITE_KEY && !turnstileToken.current) {
      setStatus({ message: "Complete the security check before sending.", state: "error" });
      return;
    }
    sending.current = true;
    setFieldErrors({});
    setStatus({ message: "Sending your request…", state: "sending" });
    const payload = buildInboundHandoffPayload(form, formLoadedAt.current, turnstileToken.current, {
      sacredBharatContext,
      source,
    });
    submissionKey.current = isSacredBharat
      ? await replaySafeSacredSubmissionKey(sacredBharatContext, payload)
      : submissionKey.current || crypto.randomUUID();
    const activeSubmissionKey = submissionKey.current;
    return sendInboundHandoff(payload, activeSubmissionKey)
      .then((result) => {
        if (!result.ok) {
          setStatus({ message: result.message, state: "error" });
          return;
        }
        setForm(initialForm(initialBrief, defaultDestination, source));
        turnstileToken.current = "";
        formLoadedAt.current = Date.now();
        if (isSacredBharat) {
          clearSacredSubmissionKey(sacredBharatContext, activeSubmissionKey);
          submissionKey.current = "";
        } else {
          submissionKey.current = crypto.randomUUID();
        }
        setStatus({
          message: `Request received. Reference ${result.receiptReference}. ${successMessage} This receipt does not confirm a booking or availability.`,
          state: "success",
        });
      })
      .catch(() => {
        setStatus({
          message: formatContactSubmissionError(),
          state: "error",
        });
      })
      .finally(() => {
        if (TURNSTILE_SITE_KEY) {
          turnstileToken.current = "";
          setTurnstileGeneration((current) => current + 1);
        }
        sending.current = false;
      });
  };

  const clearTurnstileToken = () => {
    turnstileToken.current = "";
  };
  const verifyTurnstileToken = (token) => {
    turnstileToken.current = token;
  };

  return (
    <m.div
      className={`${
        isSacredBharat
          ? "rounded-2xl border border-brand-light bg-white p-4 shadow-sm"
          : "border-brand-border/50 border-t bg-white px-4 py-3"
      } ${
        isSacredBharat
          ? "shrink-0"
          : "max-h-[55dvh] min-h-0 shrink overflow-y-auto overscroll-contain"
      }`}
      layout={shouldReduceMotion ? false : "position"}
      transition={CONCIERGE_HANDOFF_LAYOUT_SPRING}
    >
      <button
        aria-controls={formRegionId}
        aria-expanded={expanded}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-brand-border px-3 text-left font-medium text-citius-blue text-sm hover:bg-slate-50"
        onClick={toggleExpanded}
        type="button"
        {...triggerIconMotion}
      >
        <span className="inline-flex items-center gap-2">
          <PhoneCallIcon aria-hidden="true" ref={phoneIconRef} size={16} /> {triggerLabel}
        </span>
        <ChevronDownIcon
          aria-hidden="true"
          className={`transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
          ref={chevronIconRef}
          size={16}
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded ? (
          <HandoffFormPresence key="contact-form" motion={disclosureMotion}>
            <InboundHandoffForm
              clearTurnstileToken={clearTurnstileToken}
              contextDescription={contextDescription}
              fieldErrors={fieldErrors}
              fieldIdPrefix={fieldIdPrefix}
              form={form}
              formRef={formRef}
              formRegionId={formRegionId}
              isSacredBharat={isSacredBharat}
              privacyCopy={privacyCopy}
              status={status}
              submit={submit}
              turnstileGeneration={turnstileGeneration}
              updateField={updateField}
              verifyTurnstileToken={verifyTurnstileToken}
            />
          </HandoffFormPresence>
        ) : null}
      </AnimatePresence>
    </m.div>
  );
}

export function ConciergeContactHandoff({
  defaultExpanded = false,
  initialBrief,
  privacyCopy,
  triggerLabel = "Ask Citius to contact me",
} = {}) {
  return (
    <InboundContactHandoff
      defaultExpanded={defaultExpanded}
      initialBrief={initialBrief}
      privacyCopy={privacyCopy}
      source="Citius Concierge"
      successMessage="A Citius travel specialist will review the brief and contact you using the details provided."
      triggerLabel={triggerLabel}
    />
  );
}

export function SacredBharatContactHandoff({ context, triggerLabel = "Plan with Citius" }) {
  const normalizedContext = normalizeSacredBharatIntentContext(context);
  if (!normalizedContext) {
    return null;
  }
  return (
    <InboundContactHandoff
      sacredBharatContext={normalizedContext}
      source="Sacred Bharat"
      successMessage="A Citius travel specialist will review the planning request and contact you using the details provided."
      triggerLabel={triggerLabel}
    />
  );
}
