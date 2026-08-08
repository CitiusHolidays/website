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

async function sendConciergeHandoff(payload) {
  const response = await fetch("/api/inbound-intents", {
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error || "Request could not be sent.");
  }
}

export function ConciergeContactHandoff() {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [status, setStatus] = useState({ message: "", state: "idle" });
  const [turnstileGeneration, setTurnstileGeneration] = useState(0);
  const formLoadedAt = useRef(0);
  const sending = useRef(false);
  const turnstileToken = useRef("");

  const toggleExpanded = () => {
    const nextExpanded = !expanded;
    if (nextExpanded) {
      formLoadedAt.current = Date.now();
    }
    setExpanded(nextExpanded);
  };
  const updateField = (event) => {
    const { checked, name, type, value } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };
  const submit = (event) => {
    event.preventDefault();
    if (sending.current) {
      return;
    }
    if (!(form.clientName.trim() && (form.contactEmail.trim() || form.contactMobile.trim()))) {
      setStatus({ message: "Add your name and either an email or mobile number.", state: "error" });
      return;
    }
    if (!form.consent) {
      setStatus({ message: "Confirm that Citius may contact you.", state: "error" });
      return;
    }
    if (TURNSTILE_SITE_KEY && !turnstileToken.current) {
      setStatus({ message: "Complete the security check before sending.", state: "error" });
      return;
    }
    sending.current = true;
    setStatus({ message: "Sending your request…", state: "sending" });
    return sendConciergeHandoff(
      buildConciergeHandoffPayload(form, formLoadedAt.current, turnstileToken.current)
    )
      .then(() => {
        setForm(INITIAL_FORM);
        turnstileToken.current = "";
        formLoadedAt.current = Date.now();
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
        <form className="mt-3 space-y-3" onSubmit={submit}>
          <p className="text-brand-muted text-xs leading-5">
            Citius receives only the fields below. Your Concierge conversation is not attached.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2 text-brand-dark text-xs">
              Name
              <input
                className="mt-1 min-h-10 w-full rounded-lg border border-brand-border px-3 text-sm"
                maxLength={160}
                name="clientName"
                onChange={updateField}
                required
                value={form.clientName}
              />
            </label>
            <label className="text-brand-dark text-xs">
              Email
              <input
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
                className="mt-1 min-h-10 w-full rounded-lg border border-brand-border px-3 text-sm"
                maxLength={50}
                name="contactMobile"
                onChange={updateField}
                type="tel"
                value={form.contactMobile}
              />
            </label>
            <label className="text-brand-dark text-xs">
              Destination
              <input
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
              checked={form.consent}
              className="mt-1 size-4 shrink-0"
              name="consent"
              onChange={updateField}
              type="checkbox"
            />
            I agree that Citius Holidays may contact me about this travel request.
          </label>
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
          {status.message ? (
            <p
              className={
                status.state === "error" ? "text-red-700 text-xs" : "text-brand-muted text-xs"
              }
              role={status.state === "error" ? "alert" : "status"}
            >
              {status.message}
            </p>
          ) : null}
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
