"use client";

import {
  ACCOUNT_DELETION_CONFIRMATION_PHRASE,
  isAccountDeletionConfirmed,
} from "@convex/lib/accountDeletionContract";
import Link from "next/link";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/application-button";
import { Field, Input } from "@/components/ui/application-field";
import { isJsonObject, type JsonValue } from "@/lib/jsonValue";
import { isRuntimeString } from "@/lib/runtimeValues";
import { ProfileAlert } from "./AccountUi";

const DELETION_ENDPOINT = "/api/account/deletion";
const SIGN_IN_PATH = "/auth/guest";
const GENERIC_FAILURE =
  "We couldn't delete your account just now. Nothing was changed. Please try again.";

const DELETED_ITEMS = [
  "Your login and every signed-in device, including Google sign-in",
  "Your profile, saved passport details and preferences",
  "Your Sacred Bharat profile, leaderboard entry, visits and saved temples and trails",
  "Your access to the journeys shown in this account",
];

const KEPT_ITEMS = [
  "Booking, payment and invoice records, for 8 years as tax rules require. They are no longer linked to you.",
  "Traveller details our operations team holds for your trips",
  "A note that an account was deleted and when, with no personal details",
];

const DANGER_OUTLINE =
  "rounded-full border border-[#9b3d32] px-4 font-semibold text-[#9b3d32] text-sm hover:bg-[#fff2f0]";
const DANGER_FILLED =
  "rounded-full bg-[#9b3d32] px-5 font-semibold text-sm text-white hover:bg-[#7f3128] disabled:hover:bg-[#9b3d32]";
const QUIET =
  "rounded-full border border-[var(--account-border)] px-4 font-semibold text-[var(--account-ink)] text-sm hover:bg-[var(--account-paper)]";

type Phase =
  | { kind: "closed" }
  | { kind: "loading" }
  | { kind: "staff" }
  | { kind: "reauth" }
  | { error: string | null; kind: "ready"; submitting: boolean }
  | { kind: "deleted"; reference: string }
  | { kind: "unavailable" };

/** The `/api/account/deletion` response fields this panel reads. */
interface DeletionResponse {
  code: string;
  error: string;
  reference: string;
  status: string;
}

function textField(body: JsonValue, key: keyof DeletionResponse) {
  const value = isJsonObject(body) ? body[key] : undefined;
  return isRuntimeString(value) ? value : "";
}

async function readResponse(response: Response): Promise<DeletionResponse> {
  let body: JsonValue;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  return {
    code: textField(body, "code"),
    error: textField(body, "error"),
    reference: textField(body, "reference"),
    status: textField(body, "status"),
  };
}

const READY: Phase = { error: null, kind: "ready", submitting: false };

/** What the panel's live region says in each state; other states say nothing. */
const PHASE_STATUS = {
  loading: "Checking your account…",
  reauth:
    "For your security, sign in again, then come back to Settings and delete your account within 10 minutes.",
  staff:
    "This login belongs to a Citius staff account, so it can't be deleted here. Contact HR to close your staff account.",
} satisfies Partial<Record<Phase["kind"], string>>;

function phaseStatus(kind: Phase["kind"]) {
  return kind === "loading" || kind === "reauth" || kind === "staff" ? PHASE_STATUS[kind] : "";
}

function phaseForCode(code: string): Phase | null {
  if (code === "staff_account") {
    return { kind: "staff" };
  }
  if (code === "reauthentication_required") {
    return { kind: "reauth" };
  }
  return null;
}

async function fetchEligibility(): Promise<Phase> {
  try {
    const response = await fetch(DELETION_ENDPOINT, { cache: "no-store" });
    const body = await readResponse(response);
    const status = response.ok ? body.status : body.code;
    return status === "ready" ? READY : (phaseForCode(status) ?? { kind: "unavailable" });
  } catch {
    return { kind: "unavailable" };
  }
}

async function requestDeletion(confirmation: string): Promise<Phase> {
  try {
    const response = await fetch(DELETION_ENDPOINT, {
      body: JSON.stringify({ confirmation }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const body = await readResponse(response);
    if (response.ok && body.reference) {
      return { kind: "deleted", reference: body.reference };
    }
    return (
      phaseForCode(body.code) ?? {
        error: body.error || GENERIC_FAILURE,
        kind: "ready",
        submitting: false,
      }
    );
  } catch {
    return { error: GENERIC_FAILURE, kind: "ready", submitting: false };
  }
}

function defaultNavigate(href: string) {
  window.location.assign(href);
}

function ConsequenceList({ items, title }: { items: string[]; title: string }) {
  return (
    <div>
      <h5 className="font-semibold text-[var(--account-ink)] text-sm">{title}</h5>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[var(--account-muted)] text-sm leading-5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Consequences() {
  return (
    <div className="grid gap-5 rounded-sm border border-[var(--account-border)] bg-[var(--account-paper)] p-5 sm:grid-cols-2">
      <ConsequenceList items={DELETED_ITEMS} title="What we delete" />
      <ConsequenceList items={KEPT_ITEMS} title="What we keep" />
      <p className="font-semibold text-[#9b3d32] text-sm sm:col-span-2">This can't be undone.</p>
    </div>
  );
}

function DeletedNotice({ headingId, reference }: { headingId: string; reference: string }) {
  const noticeRef = useRef<HTMLDivElement>(null);
  // The form that had focus is gone; move focus to the outcome so keyboard and screen-reader
  // users land on it.
  useEffect(() => noticeRef.current?.focus(), []);
  return (
    <section aria-labelledby={headingId} className="p-6" id="delete-account">
      <h4 className="sr-only" id={headingId}>
        Delete my account
      </h4>
      <div
        aria-atomic="true"
        aria-live="polite"
        className="account-focus rounded-sm border border-[#c7ddcf] bg-[#eff7f1] px-4 py-4 text-[#2d6349]"
        ref={noticeRef}
        role="status"
        tabIndex={-1}
      >
        <p className="font-semibold">Your account was deleted</p>
        <p className="mt-1 text-sm leading-5">
          You have been signed out everywhere. Your reference is{" "}
          <span className="font-mono tabular-nums">{reference}</span>; keep it if you contact us.
        </p>
      </div>
      <Link
        className="account-focus mt-4 inline-flex min-h-11 items-center rounded-full border border-[var(--account-night)] px-4 font-semibold text-[var(--account-night)] text-sm transition-colors hover:bg-[var(--account-night)] hover:text-white"
        href="/"
      >
        Return to home
      </Link>
    </section>
  );
}

function ReauthenticationPrompt({
  onCancel,
  onSignIn,
}: {
  onCancel: () => void;
  onSignIn: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Button className={DANGER_FILLED} onClick={onSignIn} surface="account" type="button">
          Sign in again
        </Button>
        <Button className={QUIET} onClick={onCancel} surface="account" type="button">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ConfirmationForm({
  confirmation,
  error,
  onCancel,
  onChange,
  onSubmit,
  submitting,
}: {
  confirmation: string;
  error: string | null;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
}) {
  return (
    <form className="space-y-4" noValidate onSubmit={onSubmit}>
      <div className="max-w-sm">
        <Field
          description="This deletes the account you are signed in to."
          label={`Type ${ACCOUNT_DELETION_CONFIRMATION_PHRASE} to confirm`}
          surface="account"
        >
          <Input
            autoCapitalize="characters"
            autoComplete="off"
            className="bg-white"
            disabled={submitting}
            name="confirmation"
            onChange={(event) => onChange(event.target.value)}
            spellCheck={false}
            surface="account"
            value={confirmation}
          />
        </Field>
      </div>
      {error ? <ProfileAlert message={error} type="error" /> : null}
      <div className="flex flex-wrap gap-3">
        <Button
          className={DANGER_FILLED}
          disabled={!isAccountDeletionConfirmed(confirmation) || submitting}
          surface="account"
          type="submit"
        >
          {submitting ? "Deleting…" : "Delete my account permanently"}
        </Button>
        <Button className={QUIET} onClick={onCancel} surface="account" type="button">
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * The last Account Settings row: self-service deletion (ADR 0019). The server enforces staff
 * refusal, the fresh sign-in and the typed confirmation; this panel explains them.
 */
export function AccountDeletionSection({
  navigate = defaultNavigate,
  signOut,
}: {
  navigate?: (href: string) => void;
  signOut?: () => Promise<void>;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "closed" });
  const [confirmation, setConfirmation] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const eligibilityRequest = useRef(0);
  const panelId = useId();
  const headingId = useId();
  const isOpen = phase.kind !== "closed";

  const reset = () => {
    eligibilityRequest.current += 1;
    setPhase({ kind: "closed" });
    setConfirmation("");
  };

  const toggle = async () => {
    if (isOpen) {
      reset();
      return;
    }
    eligibilityRequest.current += 1;
    const request = eligibilityRequest.current;
    setPhase({ kind: "loading" });
    const next = await fetchEligibility();
    if (eligibilityRequest.current === request) {
      setPhase(next);
    }
  };

  const close = () => {
    reset();
    triggerRef.current?.focus();
  };

  const signInAgain = async () => {
    try {
      await signOut?.();
    } finally {
      navigate(SIGN_IN_PATH);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (phase.kind !== "ready" || phase.submitting || !isAccountDeletionConfirmed(confirmation)) {
      return;
    }
    setPhase({ error: null, kind: "ready", submitting: true });
    const next = await requestDeletion(confirmation);
    setPhase(next);
    if (next.kind === "deleted") {
      // Every session is already deleted on the server; clearing this browser's cookie is best effort.
      await signOut?.().catch(() => undefined);
    }
  };

  if (phase.kind === "deleted") {
    return <DeletedNotice headingId={headingId} reference={phase.reference} />;
  }

  return (
    <section aria-labelledby={headingId} id="delete-account">
      <div className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
        <div>
          <h4 className="font-medium text-[var(--account-ink)]" id={headingId}>
            Delete my account
          </h4>
          <p className="mt-1 text-[var(--account-muted)] text-sm leading-5">
            Permanently delete your Customer Travel Account and sign out everywhere.
          </p>
        </div>
        <Button
          aria-controls={panelId}
          aria-expanded={isOpen}
          className={DANGER_OUTLINE}
          onClick={toggle}
          ref={triggerRef}
          surface="account"
          type="button"
        >
          Delete my account
        </Button>
      </div>

      {isOpen ? (
        <div className="space-y-5 px-6 pb-6" id={panelId}>
          <p
            aria-atomic="true"
            aria-live="polite"
            className="text-[var(--account-ink)] text-sm leading-6 empty:hidden"
            role="status"
          >
            {phaseStatus(phase.kind)}
          </p>
          {phase.kind === "unavailable" ? (
            <ProfileAlert message={GENERIC_FAILURE} type="error" />
          ) : null}
          {phase.kind === "reauth" || phase.kind === "ready" ? <Consequences /> : null}
          {phase.kind === "reauth" ? (
            <ReauthenticationPrompt onCancel={close} onSignIn={signInAgain} />
          ) : null}
          {phase.kind === "ready" ? (
            <ConfirmationForm
              confirmation={confirmation}
              error={phase.error}
              onCancel={close}
              onChange={setConfirmation}
              onSubmit={submit}
              submitting={phase.submitting}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
