"use client";

import { ChevronDown, PhoneCall } from "lucide-react";
import { useRef, useState } from "react";
import TurnstileWidget from "./TurnstileWidget";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

export function buildConciergeHandoffPayload(form, formLoadedAt, turnstileToken) {
  const payload = {
    clientName: form.clientName.trim(),
    consent: form.consent === true,
    formLoadedAt,
    source: "Citius Concierge",
  };
  const optional = {
    contactEmail: form.contactEmail.trim().toLowerCase(),
    contactMobile: form.contactMobile.trim(),
    destination: form.destination.trim(),
    travelStartDate: form.travelStartDate,
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value) {
      payload[key] = value;
    }
  }
  const paxCount = Number(form.paxCount);
  if (Number.isInteger(paxCount) && paxCount > 0) {
    payload.paxCount = paxCount;
  }
  if (turnstileToken) {
    payload.turnstileToken = turnstileToken;
  }
  return payload;
}

const INITIAL_FORM = {
  clientName: "",
  consent: false,
  contactEmail: "",
  contactMobile: "",
  destination: "",
  paxCount: "",
  travelStartDate: "",
};

async function sendConciergeHandoff(payload, submissionKey) {
  const response = await fetch("/api/inbound-intents", {
    body: JSON.stringify(payload),
    headers: {
      "content-type": "application/json",
      "Idempotency-Key": submissionKey,
    },
    method: "POST",
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error || "Request could not be sent.");
  }
}

export function ConciergeContactHandoff() {
  const [expanded, setExpanded] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState(INITIAL_FORM);
  const [status, setStatus] = useState({ message: "", state: "idle" });
  const [turnstileGeneration, setTurnstileGeneration] = useState(0);
  const formLoadedAt = useRef(0);
  const formRef = useRef(null);
  const sending = useRef(false);
  const submissionKey = useRef("");
  const turnstileToken = useRef("");

  const toggleExpanded = () => {
    const nextExpanded = !expanded;
    if (nextExpanded) {
      formLoadedAt.current = Date.now();
      if (!submissionKey.current) {
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
      ...(name === "contactEmail" || name === "contactMobile" ? { contact: undefined } : {}),
      [name]: undefined,
    }));
  };
  const focusFirstError = (errors) => {
    const firstName = ["clientName", "contactEmail", "contactMobile", "consent"].find(
      (name) => errors[name] || (name === "contactEmail" && errors.contact)
    );
    if (firstName) {
      requestAnimationFrame(() => formRef.current?.elements.namedItem(firstName)?.focus());
    }
  };
  const submit = (event) => {
    event.preventDefault();
    if (sending.current) {
      return;
    }
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
    return sendConciergeHandoff(
      buildConciergeHandoffPayload(form, formLoadedAt.current, turnstileToken.current),
      submissionKey.current
    )
      .then(() => {
        setForm(INITIAL_FORM);
        turnstileToken.current = "";
        formLoadedAt.current = Date.now();
        submissionKey.current = crypto.randomUUID();
        setTurnstileGeneration((current) => current + 1);
        setStatus({
          message: "Request received. A Citius travel specialist will contact you.",
          state: "success",
        });
      })
      .catch((error) => {
        setStatus({
          message: error instanceof Error ? error.message : "Request could not be sent.",
          state: "error",
        });
      })
      .finally(() => {
        sending.current = false;
      });
  };

  return (
    <div
      className={`border-brand-border/50 border-t bg-white px-4 py-3 ${
        expanded ? "max-h-[55dvh] min-h-0 shrink overflow-y-auto overscroll-contain" : "shrink-0"
      }`}
    >
      <button
        aria-expanded={expanded}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-brand-border px-3 text-left font-medium text-citius-blue text-sm hover:bg-slate-50"
        onClick={toggleExpanded}
        type="button"
      >
        <span className="inline-flex items-center gap-2">
          <PhoneCall aria-hidden="true" size={16} /> Ask Citius to contact me
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
          size={16}
        />
      </button>
      {expanded ? (
        <form
          aria-busy={status.state === "sending"}
          className="mt-3 space-y-3"
          noValidate
          onSubmit={submit}
          ref={formRef}
        >
          <p className="text-brand-muted text-xs leading-5">
            Citius receives only the fields below. Your Concierge conversation is not attached.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2 text-brand-dark text-xs">
              Name
              <input
                aria-describedby={fieldErrors.clientName ? "concierge-name-error" : undefined}
                aria-invalid={fieldErrors.clientName ? "true" : "false"}
                autoComplete="name"
                className="mt-1 min-h-10 w-full rounded-lg border border-brand-border px-3 text-sm"
                maxLength={160}
                name="clientName"
                onChange={updateField}
                required
                value={form.clientName}
              />
              {fieldErrors.clientName ? (
                <span className="mt-1 block text-red-700" id="concierge-name-error">
                  {fieldErrors.clientName}
                </span>
              ) : null}
            </label>
            <label className="text-brand-dark text-xs">
              Email
              <input
                aria-describedby={fieldErrors.contact ? "concierge-contact-error" : undefined}
                aria-invalid={fieldErrors.contact ? "true" : "false"}
                autoComplete="email"
                className="mt-1 min-h-10 w-full rounded-lg border border-brand-border px-3 text-sm"
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
                aria-describedby={fieldErrors.contact ? "concierge-contact-error" : undefined}
                aria-invalid={fieldErrors.contact ? "true" : "false"}
                autoComplete="tel"
                className="mt-1 min-h-10 w-full rounded-lg border border-brand-border px-3 text-sm"
                maxLength={50}
                name="contactMobile"
                onChange={updateField}
                type="tel"
                value={form.contactMobile}
              />
            </label>
            {fieldErrors.contact ? (
              <p className="col-span-2 text-red-700 text-xs" id="concierge-contact-error">
                {fieldErrors.contact}
              </p>
            ) : null}
            <label className="text-brand-dark text-xs">
              Destination
              <input
                autoComplete="off"
                className="mt-1 min-h-10 w-full rounded-lg border border-brand-border px-3 text-sm"
                maxLength={240}
                name="destination"
                onChange={updateField}
                value={form.destination}
              />
            </label>
            <label className="text-brand-dark text-xs">
              Travellers
              <input
                className="mt-1 min-h-10 w-full rounded-lg border border-brand-border px-3 text-sm"
                max={1000}
                min={1}
                name="paxCount"
                onChange={updateField}
                type="number"
                value={form.paxCount}
              />
            </label>
            <label className="col-span-2 text-brand-dark text-xs">
              Preferred travel date
              <input
                className="mt-1 min-h-10 w-full rounded-lg border border-brand-border px-3 text-sm"
                name="travelStartDate"
                onChange={updateField}
                type="date"
                value={form.travelStartDate}
              />
            </label>
          </div>
          <label className="flex gap-2 text-brand-muted text-xs leading-5">
            <input
              aria-describedby={fieldErrors.consent ? "concierge-consent-error" : undefined}
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
            <p className="text-red-700 text-xs" id="concierge-consent-error">
              {fieldErrors.consent}
            </p>
          ) : null}
          {TURNSTILE_SITE_KEY ? (
            <TurnstileWidget
              key={turnstileGeneration}
              onError={() => {
                turnstileToken.current = "";
              }}
              onExpire={() => {
                turnstileToken.current = "";
              }}
              onVerify={(token) => {
                turnstileToken.current = token;
              }}
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
            Send contact request
          </button>
        </form>
      ) : null}
    </div>
  );
}
