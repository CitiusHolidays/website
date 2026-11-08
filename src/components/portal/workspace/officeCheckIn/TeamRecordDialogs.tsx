"use client";

import { api } from "@convex/_generated/api";
import { needsAwayReason } from "@convex/crm/officeCheckInVerification";
import { useMutation } from "convex/react";
import {
  type ChangeEvent,
  type FormEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { usePortalToast } from "@/components/portal/PortalToast";
import { ControlledDialogClose, ControlledDialogTitle } from "@/components/ui/application-dialog";
import {
  AWAY_REASON_LABELS,
  formatOfficeDateTime,
  formatOfficeTime,
  formatSessionSpan,
  formatSessionsLine,
  formatWorkDate,
  officeTimeToTimestamp,
  reasonProblem,
  type SessionDeletion,
  teamStatusFor,
  timestampToClockTime,
} from "@/lib/officeCheckIn/presentation";
import { useTrackedQuery as useQuery } from "@/lib/portal/trackedConvexSubscriptions";
import { formatConvexError } from "../portalWorkspaceListHelpers";
import { AwayLocationNote } from "./AwayLocationNote";
import { DeleteSessionForm } from "./DeleteSessionForm";
import {
  DialogBody,
  DialogFooter,
  FIELD_HINT,
  FIELD_LABEL,
  FieldError,
  OfficeDialog,
  ReasonField,
  ServerError,
  SignalList,
  ToneBadge,
} from "./OfficeCheckInParts";
import type { CheckInRecord, TeamDayRow } from "./officeCheckInTypes";

export interface TeamRecordDialogTarget {
  row: TeamDayRow;
  workDate: string;
}

type SessionMode = "correct" | "delete" | "review";
type Mode = { kind: "details" } | { kind: "manual" } | { kind: SessionMode; sessionId: SessionId };
type SessionId = CheckInRecord["_id"];

const DETAILS: Mode = { kind: "details" };

/** Opens straight into the one job a row most likely needs. */
function initialMode(row: TeamDayRow): Mode {
  const record = row.checkIn;
  if (!record) {
    return row.canReview ? { kind: "manual" } : DETAILS;
  }
  if (row.canReview && record.source === "self" && record.admission === "pending_review") {
    return { kind: "review", sessionId: record._id };
  }
  return DETAILS;
}

/** The person's own answer to where they were working, when their check didn't pass. */
function awayNote(record: CheckInRecord) {
  if (!needsAwayReason(record)) {
    return null;
  }
  return record.awayReason
    ? `They said they're working: ${AWAY_REASON_LABELS[record.awayReason]}.`
    : "They haven't said where they're working.";
}

function reviewNote(record: CheckInRecord) {
  if (record.source === "manager_entry") {
    return record.review
      ? `Entered by ${record.review.reviewerName}. Reason: ${record.review.reason}`
      : "Entered by a manager. There's no device evidence for a manual entry.";
  }
  if (record.review) {
    const verb = record.review.decision === "accepted" ? "Accepted" : "Rejected";
    return `${verb} by ${record.review.reviewerName}. Reason: ${record.review.reason}`;
  }
  return null;
}

function RecordHistory({
  checkInId,
  timeZone,
}: {
  checkInId: CheckInRecord["_id"];
  timeZone: string;
}) {
  const events = useQuery(api.crm.officeCheckIns.history, { checkInId });
  if (!events || events.length === 0) {
    return null;
  }
  return (
    <details className="group">
      <summary className="inline-flex min-h-10 cursor-pointer items-center text-citius-blue text-sm">
        History ({events.length})
      </summary>
      <ul className="mt-1 grid gap-2">
        {events.map((event) => (
          <li className="text-brand-muted text-xs" key={event.id}>
            <span className="tabular-nums">{formatOfficeDateTime(event.at, timeZone)}</span> ·{" "}
            {event.actorName}: {event.summary}
            {event.reason ? <span className="block text-brand-dark">“{event.reason}”</span> : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** What happened that day, in plain words: status, times, each signal, any review. */
function RecordSummary({ record, timeZone }: { record: CheckInRecord; timeZone: string }) {
  const status = teamStatusFor(record);
  const away = awayNote(record);
  const note = reviewNote(record);
  return (
    <div className="grid gap-3 rounded-xl bg-brand-light/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-heading font-semibold text-brand-dark text-lg tabular-nums">
          {formatOfficeTime(record.clockInAt, timeZone)} →{" "}
          {formatOfficeTime(record.clockOutAt, timeZone)}
        </span>
        <ToneBadge label={status.label} tone={status.tone} />
      </div>
      {record.source === "self" ? (
        <SignalList awayReason={record.awayReason} record={record.clockIn} />
      ) : null}
      {away ? <p className="font-medium text-brand-dark text-sm">{away}</p> : null}
      <AwayLocationNote record={record} timeZone={timeZone} viewer="reviewer" />
      {record.clockOut && record.clockOut.outcome !== "pass" ? (
        <div className="grid gap-2">
          <p className="font-medium text-brand-dark text-sm">At clock-out</p>
          <SignalList awayReason={record.awayReason} record={record.clockOut} />
        </div>
      ) : null}
      {note ? <p className="text-brand-dark text-sm">{note}</p> : null}
      {record.correctedAt ? <p className={FIELD_HINT}>A manager corrected these times.</p> : null}
    </div>
  );
}

function DialogHeading({ subtitle, title }: { subtitle: string; title: string }) {
  return (
    <div className="mb-4">
      <ControlledDialogTitle className="font-heading font-semibold text-citius-blue text-lg">
        {title}
      </ControlledDialogTitle>
      <p className="mt-1 text-brand-muted text-sm">{subtitle}</p>
    </div>
  );
}

function useDialogSubmit(onBusyChange: (busy: boolean) => void) {
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState("");
  const run = async (action: () => Promise<void>, fallback: string) => {
    if (busy) {
      return;
    }
    setBusy(true);
    onBusyChange(true);
    setServerError("");
    try {
      await action();
    } catch (error) {
      setServerError(formatConvexError(error, fallback));
    }
    setBusy(false);
    onBusyChange(false);
  };
  return { busy, run, serverError };
}

/** Moves focus into a form that replaced the details view. */
function useFocusOnMount(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    if (enabled) {
      ref.current?.focus();
    }
  }, [enabled, ref]);
}

function FormActions({
  busy,
  onBack,
  submitLabel,
}: {
  busy: boolean;
  onBack: (() => void) | null;
  submitLabel: string;
}) {
  const label = busy ? "Saving…" : submitLabel;
  return (
    <DialogFooter>
      {onBack ? (
        <button className="portal-outline-btn" disabled={busy} onClick={onBack} type="button">
          Back
        </button>
      ) : (
        <ControlledDialogClose className="portal-outline-btn" disabled={busy} type="button">
          Cancel
        </ControlledDialogClose>
      )}
      <button
        aria-busy={busy || undefined}
        className="portal-primary-btn"
        disabled={busy}
        type="submit"
      >
        {label}
      </button>
    </DialogFooter>
  );
}

interface ModeProps {
  context: DialogContext;
  focusFirst: boolean;
  onBack: (() => void) | null;
}

interface DialogContext {
  deletion: SessionDeletion | null;
  heading: { subtitle: string; title: string };
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
  row: TeamDayRow;
  /** The session a Review, Correct times or Delete acts on. */
  session: CheckInRecord | null;
  workDate: string;
}

type ReviewDecision = "accepted" | "rejected";

function ReviewMode({ context, focusFirst, onBack }: ModeProps) {
  const toast = usePortalToast();
  const review = useMutation(api.crm.officeCheckIns.review);
  const { busy, run, serverError } = useDialogSubmit(context.onBusyChange);
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [reason, setReason] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement | null>(null);
  const decisionRef = useRef<HTMLInputElement | null>(null);
  useFocusOnMount(decisionRef, focusFirst);
  const id = useId();
  const { row, session: record } = context;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!record) {
      return;
    }
    const nextDecisionError = decision ? null : "Choose whether this check-in counts.";
    const nextReasonError = reasonProblem(reason);
    setDecisionError(nextDecisionError);
    setReasonError(nextReasonError);
    if (nextDecisionError) {
      decisionRef.current?.focus();
      return;
    }
    if (nextReasonError || !decision) {
      reasonRef.current?.focus();
      return;
    }
    await run(async () => {
      await review({ checkInId: record._id, decision, reason: reason.trim() });
      toast.success(`Review saved for ${row.name}.`);
      context.onDone();
    }, "Couldn't save the review. Try again.");
  };

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    setDecision(event.currentTarget.value === "rejected" ? "rejected" : "accepted");
    setDecisionError(null);
  };

  if (!record) {
    return null;
  }
  return (
    <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={submit}>
      <DialogBody>
        <DialogHeading {...context.heading} />
        <RecordSummary record={record} timeZone={row.timeZone} />
        <fieldset
          aria-describedby={decisionError ? `${id}-decision-error` : undefined}
          className="mt-5 grid gap-1"
        >
          <legend className={`${FIELD_LABEL} mb-1`}>Does this check-in count?</legend>
          <label className="flex min-h-10 items-center gap-2 text-brand-dark text-sm">
            <input
              checked={decision === "accepted"}
              className="size-4 accent-citius-blue"
              name="decision"
              onChange={choose}
              ref={decisionRef}
              type="radio"
              value="accepted"
            />
            Yes, accept it
          </label>
          <label className="flex min-h-10 items-center gap-2 text-brand-dark text-sm">
            <input
              checked={decision === "rejected"}
              className="size-4 accent-citius-blue"
              name="decision"
              onChange={choose}
              type="radio"
              value="rejected"
            />
            No, reject it
          </label>
          <FieldError id={`${id}-decision-error`} message={decisionError} />
        </fieldset>
        <div className="mt-4">
          <ReasonField
            error={reasonError}
            inputRef={reasonRef}
            onChange={setReason}
            value={reason}
          />
        </div>
        <div className="mt-3">
          <RecordHistory checkInId={record._id} timeZone={row.timeZone} />
        </div>
        <div className="mt-3">
          <ServerError message={serverError} />
        </div>
      </DialogBody>
      <FormActions busy={busy} onBack={onBack} submitLabel="Save review" />
    </form>
  );
}

function TimeField({
  error,
  hint,
  inputRef,
  label,
  onChange,
  value,
}: {
  error: string | null;
  hint?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  const handleChange = (event: ChangeEvent<HTMLInputElement>) =>
    onChange(event.currentTarget.value);
  return (
    <div className="grid content-start gap-1.5">
      <label className={FIELD_LABEL} htmlFor={`${id}-time`}>
        {label}
      </label>
      <input
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
        className="portal-input text-base tabular-nums aria-[invalid=true]:border-red-400 sm:text-sm"
        id={`${id}-time`}
        onChange={handleChange}
        ref={inputRef}
        type="time"
        value={value}
      />
      {hint ? (
        <p className={FIELD_HINT} id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

interface TimesDraft {
  clockIn: string;
  clockOut: string;
  reason: string;
}

interface TimesErrors {
  clockIn: string | null;
  clockOut: string | null;
  reason: string | null;
}

function validateTimes(draft: TimesDraft, workDate: string, timeZone: string) {
  const clockInAt = officeTimeToTimestamp(workDate, draft.clockIn, timeZone);
  const clockOutAt = draft.clockOut
    ? officeTimeToTimestamp(workDate, draft.clockOut, timeZone)
    : null;
  const errors: TimesErrors = {
    clockIn: clockInAt === null ? "Enter the clock-in time as HH:MM." : null,
    clockOut: null,
    reason: reasonProblem(draft.reason),
  };
  if (draft.clockOut && clockOutAt === null) {
    errors.clockOut = "Enter the clock-out time as HH:MM, or leave it empty.";
  } else if (clockInAt !== null && clockOutAt !== null && clockOutAt <= clockInAt) {
    errors.clockOut = "Clock-out must be after clock-in.";
  }
  return { clockInAt, clockOutAt, errors };
}

type SaveTimes = (input: {
  clockInAt: number;
  clockOutAt: number | null;
  reason: string;
}) => Promise<void>;

function TimesMode({
  context,
  focusFirst,
  intro,
  initial,
  onBack,
  onSave,
  submitLabel,
}: ModeProps & {
  initial: TimesDraft;
  intro: string;
  onSave: SaveTimes;
  submitLabel: string;
}) {
  const { busy, run, serverError } = useDialogSubmit(context.onBusyChange);
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<TimesErrors>({
    clockIn: null,
    clockOut: null,
    reason: null,
  });
  const clockInRef = useRef<HTMLInputElement | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement | null>(null);
  useFocusOnMount(clockInRef, focusFirst);
  const { row, workDate } = context;
  const setField = (field: keyof TimesDraft) => (value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validateTimes(draft, workDate, row.timeZone);
    setErrors(result.errors);
    if (result.errors.clockIn || result.errors.clockOut || result.clockInAt === null) {
      clockInRef.current?.focus();
      return;
    }
    if (result.errors.reason) {
      reasonRef.current?.focus();
      return;
    }
    const { clockInAt, clockOutAt } = result;
    await run(
      () => onSave({ clockInAt, clockOutAt, reason: draft.reason.trim() }),
      "Couldn't save these times. Try again."
    );
  };

  return (
    <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={submit}>
      <DialogBody>
        <DialogHeading {...context.heading} />
        {context.session ? (
          <RecordSummary record={context.session} timeZone={row.timeZone} />
        ) : null}
        <p className="mt-4 text-brand-dark text-sm">{intro}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TimeField
            error={errors.clockIn}
            inputRef={clockInRef}
            label="Clock-in time"
            onChange={setField("clockIn")}
            value={draft.clockIn}
          />
          <TimeField
            error={errors.clockOut}
            hint="Leave empty if they're still in the office."
            label="Clock-out time"
            onChange={setField("clockOut")}
            value={draft.clockOut}
          />
        </div>
        <div className="mt-4">
          <ReasonField
            error={errors.reason}
            inputRef={reasonRef}
            onChange={setField("reason")}
            value={draft.reason}
          />
        </div>
        <div className="mt-3">
          <ServerError message={serverError} />
        </div>
      </DialogBody>
      <FormActions busy={busy} onBack={onBack} submitLabel={submitLabel} />
    </form>
  );
}

function CorrectMode(props: ModeProps) {
  const toast = usePortalToast();
  const correctTimes = useMutation(api.crm.officeCheckIns.correctTimes);
  const { row, session: record } = props.context;
  if (!record) {
    return null;
  }
  const save: SaveTimes = async (input) => {
    await correctTimes({ checkInId: record._id, ...input });
    toast.success(`Times corrected for ${row.name}.`);
    props.context.onDone();
  };
  return (
    <TimesMode
      {...props}
      initial={{
        clockIn: timestampToClockTime(record.clockInAt, row.timeZone),
        clockOut: timestampToClockTime(record.clockOutAt, row.timeZone),
        reason: "",
      }}
      intro="Change the times below. The device evidence stays as it was recorded."
      onSave={save}
      submitLabel="Save times"
    />
  );
}

function manualIntro(row: TeamDayRow) {
  if (row.sessions.length === 0) {
    return `${row.name} has no check-in for this day. If they were in the office but couldn't check in, add their times. It's saved as a manual entry with no device evidence.`;
  }
  return `Add another session for ${row.name}. It can't overlap their other sessions (${formatSessionsLine(row.sessions, row.timeZone)}). It's saved as a manual entry with no device evidence.`;
}

function ManualMode(props: ModeProps) {
  const toast = usePortalToast();
  const recordManualEntry = useMutation(api.crm.officeCheckIns.recordManualEntry);
  const { row, workDate } = props.context;
  const save: SaveTimes = async (input) => {
    await recordManualEntry({ staffId: row.staffId, workDate, ...input });
    toast.success(`Entry added for ${row.name}.`);
    props.context.onDone();
  };
  return (
    <TimesMode
      {...props}
      initial={{ clockIn: "", clockOut: "", reason: "" }}
      intro={manualIntro(row)}
      onSave={save}
      submitLabel="Add entry"
    />
  );
}

function DeleteMode({ context, onBack }: ModeProps) {
  const { deletion, heading, row, session } = context;
  if (!(deletion && session)) {
    return null;
  }
  return (
    <DeleteSessionForm
      deletion={deletion}
      onBack={onBack}
      onBusyChange={context.onBusyChange}
      onDone={context.onDone}
      personName={row.name}
      session={session}
      subtitle={`${row.name} · ${heading.subtitle}`}
      timeZone={row.timeZone}
    />
  );
}

/** One session's summary, history and the actions the caller may take on it. */
function SessionBlock({
  context,
  onChoose,
  session,
}: {
  context: DialogContext;
  onChoose: (mode: Mode) => void;
  session: CheckInRecord;
}) {
  const { deletion, row } = context;
  const choose = (kind: SessionMode) => () => onChoose({ kind, sessionId: session._id });
  const canReview = row.canReview && session.source === "self";
  return (
    <section
      aria-label={`Session ${formatSessionSpan(session, row.timeZone)}`}
      className="grid gap-2"
    >
      <RecordSummary record={session} timeZone={row.timeZone} />
      {row.canReview || deletion ? (
        <div className="flex flex-wrap items-center gap-2">
          {canReview ? (
            <button className="portal-small-btn" onClick={choose("review")} type="button">
              Review
            </button>
          ) : null}
          {row.canReview ? (
            <button className="portal-small-btn" onClick={choose("correct")} type="button">
              Correct times
            </button>
          ) : null}
          {deletion ? (
            <button className="portal-small-btn" onClick={choose("delete")} type="button">
              Delete session
            </button>
          ) : null}
        </div>
      ) : null}
      <RecordHistory checkInId={session._id} timeZone={row.timeZone} />
    </section>
  );
}

function DetailsMode({
  context,
  onChoose,
}: {
  context: DialogContext;
  onChoose: (mode: Mode) => void;
}) {
  const { row } = context;
  const addSession = () => onChoose({ kind: "manual" });
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DialogBody>
        <DialogHeading {...context.heading} />
        {row.sessions.length > 0 ? (
          <div className="grid gap-5">
            {row.sessions.map((session) => (
              <SessionBlock
                context={context}
                key={session._id}
                onChoose={onChoose}
                session={session}
              />
            ))}
          </div>
        ) : (
          <p className="text-brand-dark text-sm">No check-in for this day.</p>
        )}
        {row.canReview ? null : (
          <p className="mt-3 text-brand-muted text-sm">
            You can't change this record. Your own check-ins are reviewed by your manager.
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <ControlledDialogClose className="portal-outline-btn" type="button">
          Close
        </ControlledDialogClose>
        {row.canReview && row.sessions.length > 0 ? (
          <button className="portal-outline-btn" onClick={addSession} type="button">
            Add a session
          </button>
        ) : null}
      </DialogFooter>
    </div>
  );
}

function RecordDialogContent({
  deletion,
  onBusyChange,
  onDone,
  target,
}: {
  deletion: SessionDeletion | null;
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
  target: TeamRecordDialogTarget;
}) {
  const { row, workDate } = target;
  const [firstMode] = useState<Mode>(() => initialMode(row));
  const [chosen, setMode] = useState<Mode>(firstMode);
  const session =
    "sessionId" in chosen
      ? (row.sessions.find((candidate) => candidate._id === chosen.sessionId) ?? null)
      : null;
  // A session that disappeared (deleted elsewhere) falls back to the details.
  const mode = "sessionId" in chosen && !session ? DETAILS : chosen;
  const office = row.officeName ? ` · ${row.officeName}` : "";
  const context: DialogContext = {
    // On your own row only Admin's erase applies; Directors never delete their own sessions.
    deletion: row.canReview || deletion === "erase" ? deletion : null,
    heading: {
      subtitle: `${formatWorkDate(workDate)}${office} · times in ${row.timeZone}`,
      title: firstMode.kind === "manual" ? `Add an entry for ${row.name}` : row.name,
    },
    onBusyChange,
    onDone,
    row,
    session,
    workDate,
  };
  // Back returns to the details whenever there are sessions to show there.
  const back = row.sessions.length > 0 ? () => setMode(DETAILS) : null;
  const switched = mode !== firstMode;
  switch (mode.kind) {
    case "review":
      return <ReviewMode context={context} focusFirst={switched} onBack={back} />;
    case "correct":
      return <CorrectMode context={context} focusFirst={switched} onBack={back} />;
    case "delete":
      return <DeleteMode context={context} focusFirst={switched} onBack={back} />;
    case "manual":
      return <ManualMode context={context} focusFirst={switched} onBack={back} />;
    default:
      return <DetailsMode context={context} onChoose={setMode} />;
  }
}

/**
 * The single dialog behind each team row's Open button. It lists the day's
 * sessions and offers Review, Correct times, Delete session (Admin and
 * Directors) or Add entry as the row allows. Every save needs a reason,
 * which goes into the history.
 */
export function TeamRecordDialog({
  deletion,
  onClose,
  target,
}: {
  deletion: SessionDeletion | null;
  onClose: () => void;
  target: TeamRecordDialogTarget | null;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <OfficeDialog busy={busy} onClose={onClose} open={Boolean(target)}>
      {target ? (
        <RecordDialogContent
          deletion={deletion}
          key={`${target.row.staffId}:${target.workDate}`}
          onBusyChange={setBusy}
          onDone={onClose}
          target={target}
        />
      ) : null}
    </OfficeDialog>
  );
}
