"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  type PostTourReportContent,
  postTourReportError,
  REPORT_HITS,
  REPORT_MISSES,
  REPORT_PERFORMANCE,
  REPORT_PROGRAMMES,
  reportNeedsClosureDetails,
} from "@convex/lib/postTourReportContent";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import {
  cloneElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { usePortalConfirm } from "@/components/portal/PortalConfirmDialog";
import { PortalDateInput } from "@/components/portal/PortalDateInput";
import { Button } from "@/components/ui/application-button";
import { inputVariants, textareaVariants } from "@/components/ui/application-field-variants";
import { formatDisplayDate } from "@/lib/formatDate";

type Workspace = NonNullable<FunctionReturnType<typeof api.crm.postTourReports.workspace>>;
type Report = NonNullable<Workspace["report"]>;
const draftCache = new Map<string, { content: PostTourReportContent; revision: number }>();
const fieldClass = inputVariants({ surface: "staff" });
function yesNoAnswer(value: string): "Yes" | "No" | "" {
  if (value === "Yes" || value === "No") {
    return value;
  }
  return "";
}
function billingAnswer(value: string): "Completed" | "Pending" | "" {
  if (value === "Completed" || value === "Pending") {
    return value;
  }
  return "";
}
function ratingCaption(value: number) {
  if (value === 1) {
    return " · Poor";
  }
  if (value === 5) {
    return " · Excellent";
  }
  return "";
}
function supplierRating(value: string): number | "na" | null {
  if (value === "na") {
    return "na";
  }
  return value ? Number(value) : null;
}

function Field({ label, children }: { label: string; children: ReactElement<{ id?: string }> }) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-1.5">
      <label className="block font-medium text-brand-dark text-sm" htmlFor={id}>
        {label}
      </label>
      {cloneElement(children, { id })}
    </div>
  );
}
function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 border-brand-border border-t pt-6" data-report-section={number}>
      <h3 className="font-heading font-semibold text-brand-dark text-lg">
        <span className="mr-2 text-brand-muted">{number}.</span>
        {title}
      </h3>
      {children}
    </section>
  );
}
function Choices({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <select
        className={`${fieldClass} bg-white`}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">Choose...</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </Field>
  );
}
function Comment({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <Field label={label}>
      <textarea
        className={`${textareaVariants({ surface: "staff" })} bg-white`}
        maxLength={4000}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        rows={3}
        value={value}
      />
    </Field>
  );
}
function CheckList({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="mb-2 font-semibold text-brand-dark text-sm">{label}</legend>
      {options.map((option) => (
        <label className="flex min-h-11 items-center gap-2 text-sm" key={option}>
          <input
            checked={selected.includes(option)}
            className="size-4 accent-citius-blue"
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...selected, option]
                  : selected.filter((value) => value !== option)
              )
            }
            type="checkbox"
          />
          {option}
        </label>
      ))}
    </fieldset>
  );
}

export function PostTourReportForm({
  workspace,
  report,
  viewerKey,
  readOnly = false,
  onSaveDraft,
  onSubmitReport,
}: {
  workspace: Workspace;
  report: Report | null;
  viewerKey: string;
  readOnly?: boolean;
  onSaveDraft: (
    args: FunctionArgs<typeof api.crm.postTourReports.saveDraft>
  ) => Promise<FunctionReturnType<typeof api.crm.postTourReports.saveDraft>>;
  onSubmitReport: (
    args: FunctionArgs<typeof api.crm.postTourReports.submit>
  ) => Promise<FunctionReturnType<typeof api.crm.postTourReports.submit>>;
}) {
  const cacheKey = `${viewerKey}:${workspace.jobCardId}`;
  const [draft, setDraft] = useState(
    () => draftCache.get(cacheKey)?.content ?? report?.content ?? workspace.initial
  );
  const [revision, setRevision] = useState(
    () => draftCache.get(cacheKey)?.revision ?? report?.revision ?? 0
  );
  const [reportId, setReportId] = useState<Id<"postTourReports"> | null>(report?.id ?? null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);
  const change = (next: PostTourReportContent) => {
    setDraft(next);
    draftCache.set(cacheKey, { content: next, revision });
    setMessage("");
  };
  const text = (key: "highlights" | "issue" | "resolution" | "nextTime", value: string) =>
    change({ ...draft, [key]: value });
  const tour = (key: keyof PostTourReportContent["tour"], value: string | number | null) =>
    change({ ...draft, tour: { ...draft.tour, [key]: value } });
  const save = async (submitting: boolean) => {
    if (busy.current || readOnly) {
      return;
    }
    if (formRef.current?.querySelector('[aria-invalid="true"]')) {
      setError("Complete the tour dates in DD/MM/YYYY before saving.");
      return;
    }
    const validation = postTourReportError(draft, submitting);
    if (validation) {
      setError(validation);
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const saved = await onSaveDraft({
        content: draft,
        expectedRevision: revision,
        jobCardId: workspace.jobCardId,
        reportId: reportId ?? undefined,
      });
      setReportId(saved.id);
      setRevision(saved.revision);
      draftCache.set(cacheKey, { content: draft, revision: saved.revision });
      if (submitting) {
        await onSubmitReport({ expectedRevision: saved.revision, reportId: saved.id });
        draftCache.delete(cacheKey);
        setMessage("Report submitted.");
      } else {
        draftCache.delete(cacheKey);
        setMessage("Draft saved. No submission alert has been sent.");
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Report could not be saved. Your draft is still here."
      );
    }
    busy.current = false;
    setPending(false);
  };
  const id = useId();
  const submitForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    save(true);
  };
  const current = readOnly ? (report?.content ?? draft) : draft;
  // Read-only fields render the stored snapshot. Drafts never adopt a later JC edit silently.
  const content = readOnly ? current : draft;
  return (
    <form
      aria-label="Internal post-tour report"
      className="space-y-6"
      data-report-id={reportId ?? "new"}
      onSubmit={submitForm}
      ref={formRef}
    >
      <fieldset className="min-w-0 space-y-6 disabled:opacity-100" disabled={pending || readOnly}>
        <Section number={1} title="Tour details">
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["client", "Client / Company *"],
                ["destination", "Destination *"],
                ["startDate", "Tour start date *"],
                ["endDate", "Tour end date *"],
                ["tourManager", "Tour Manager *"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                {key === "startDate" || key === "endDate" ? (
                  <PortalDateInput
                    aria-label={label}
                    id={`${id}-${key}`}
                    inputClassName="!bg-white"
                    name={key}
                    onChange={(value: string) => tour(key, value)}
                    required
                    value={content.tour[key]}
                  />
                ) : (
                  <input
                    className={`${fieldClass} bg-white`}
                    maxLength={200}
                    onChange={(event) => tour(key, event.target.value)}
                    required
                    type="text"
                    value={content.tour[key]}
                  />
                )}
              </Field>
            ))}
            <Field label="Number of guests *">
              <input
                className={`${fieldClass} bg-white`}
                max={100_000}
                min={1}
                onChange={(event) =>
                  tour("guests", event.target.value ? Number(event.target.value) : null)
                }
                required
                step={1}
                type="number"
                value={content.tour.guests ?? ""}
              />
            </Field>
            <Choices
              label="Programme type"
              onChange={(value) => tour("programme", value)}
              options={REPORT_PROGRAMMES}
              value={content.tour.programme}
            />
          </div>
          <p className="text-brand-muted text-xs">
            Details start from this Job Card. Check them before submitting; the report keeps its own
            snapshot.
          </p>
        </Section>
        <Section number={2} title="Overall tour performance">
          <p className="text-brand-muted text-sm">
            Rate each question from 1, Poor, to 5, Excellent.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {REPORT_PERFORMANCE.map(([key, label]) => (
              <Field key={key} label={label}>
                <select
                  className={`${fieldClass} bg-white`}
                  onChange={(event) =>
                    change({
                      ...draft,
                      performance: {
                        ...draft.performance,
                        [key]: event.target.value ? Number(event.target.value) : null,
                      },
                    })
                  }
                  value={content.performance[key] ?? ""}
                >
                  <option value="">Choose a rating...</option>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {value}
                      {ratingCaption(value)}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <Comment
            label="What were the three biggest highlights of the tour?"
            onChange={(value) => text("highlights", value)}
            required
            value={content.highlights}
          />
        </Section>
        <Section number={3} title="Hit & Miss report">
          <p className="text-brand-muted text-sm">
            Select all that apply. Leave a list blank if there are no items to report.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <CheckList
              label="What worked well? (Hits)"
              onChange={(hits) => change({ ...draft, hits })}
              options={REPORT_HITS}
              selected={content.hits}
            />
            <CheckList
              label="What needs improvement? (Misses)"
              onChange={(misses) => change({ ...draft, misses })}
              options={REPORT_MISSES}
              selected={content.misses}
            />
          </div>
          <Comment
            label="Describe the most important issue encountered"
            onChange={(value) => text("issue", value)}
            required={content.misses.length > 0}
            value={content.issue}
          />
          <Comment
            label="How was the issue resolved?"
            onChange={(value) => text("resolution", value)}
            required={content.misses.length > 0}
            value={content.resolution}
          />
          <Comment
            label="What should we do differently next time?"
            onChange={(value) => text("nextTime", value)}
            required={content.misses.length > 0}
            value={content.nextTime}
          />
        </Section>
        <Section number={4} title="Supplier performance">
          <p className="text-brand-muted text-sm">
            Choose 1 to 5, or N.A. A score of 1 or 2 needs a short follow-up.
          </p>
          <div className="space-y-4">
            {content.suppliers.map((supplier, index) => (
              <div className="space-y-3 border-brand-border border-b pb-4" key={supplier.category}>
                <Field label={supplier.category}>
                  <select
                    className={`${fieldClass} max-w-xs bg-white`}
                    onChange={(event) => {
                      const rating = supplierRating(event.target.value);
                      change({
                        ...draft,
                        suppliers: draft.suppliers.map((row, i) =>
                          i === index
                            ? {
                                ...row,
                                followUp:
                                  rating !== "na" && rating !== null && rating <= 2
                                    ? row.followUp
                                    : "",
                                rating,
                              }
                            : row
                        ),
                      });
                    }}
                    value={supplier.rating ?? ""}
                  >
                    <option value="">Choose...</option>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        {value}
                        {ratingCaption(value)}
                      </option>
                    ))}
                    <option value="na">N.A.</option>
                  </select>
                </Field>
                {supplier.rating !== "na" && supplier.rating !== null && supplier.rating <= 2 ? (
                  <Comment
                    label={`${supplier.category}: What went wrong, and would you recommend this supplier for future groups?`}
                    onChange={(followUp) =>
                      change({
                        ...draft,
                        suppliers: draft.suppliers.map((row, i) =>
                          i === index ? { ...row, followUp } : row
                        ),
                      })
                    }
                    required
                    value={supplier.followUp}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </Section>
        <Section number={5} title="Financial and operational closure">
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["additionalCost", "Unexpected additional cost?"],
                ["budgetVariation", "Cost variation against approved budget?"],
                ["refundPending", "Refund or recovery pending?"],
              ] as const
            ).map(([key, label]) => (
              <Choices
                key={key}
                label={label}
                onChange={(value) =>
                  change({
                    ...draft,
                    closure: { ...draft.closure, [key]: yesNoAnswer(value) },
                  })
                }
                options={["No", "Yes"]}
                value={content.closure[key]}
              />
            ))}
            <Choices
              label="Billing and supplier closure completed?"
              onChange={(value) =>
                change({
                  ...draft,
                  closure: { ...draft.closure, billing: billingAnswer(value) },
                })
              }
              options={["Completed", "Pending"]}
              value={content.closure.billing}
            />
          </div>
          {reportNeedsClosureDetails(content.closure) ? (
            <Comment
              label="Amount, reason and responsible person for anything additional or pending"
              onChange={(pendingDetails) =>
                change({ ...draft, closure: { ...draft.closure, pendingDetails } })
              }
              required
              value={content.closure.pendingDetails}
            />
          ) : null}
        </Section>
        <Section number={6} title="Final assessment and ownership">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Overall tour rating, 1 to 10">
              <select
                className={`${fieldClass} bg-white`}
                onChange={(event) =>
                  change({
                    ...draft,
                    assessment: {
                      ...draft.assessment,
                      rating: event.target.value ? Number(event.target.value) : null,
                    },
                  })
                }
                value={content.assessment.rating ?? ""}
              >
                <option value="">Choose...</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
            <Choices
              label="Overall status"
              onChange={(status) =>
                change({ ...draft, assessment: { ...draft.assessment, status } })
              }
              options={["Excellent", "Good", "Needs Improvement"]}
              value={content.assessment.status}
            />
            <Choices
              label="Repeat this destination and itinerary for a similar group?"
              onChange={(repeat) =>
                change({ ...draft, assessment: { ...draft.assessment, repeat } })
              }
              options={["Yes", "Yes, with changes", "No"]}
              value={content.assessment.repeat}
            />
          </div>
          <Comment
            label="Top three learnings for future trips"
            onChange={(learnings) =>
              change({ ...draft, assessment: { ...draft.assessment, learnings } })
            }
            required
            value={content.assessment.learnings}
          />
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-brand-muted">Prepared by</dt>
              <dd>{report?.preparedBy ?? workspace.viewerName}</dd>
            </div>
            <div>
              <dt className="text-brand-muted">Date of submission</dt>
              <dd>
                {report?.submittedAt
                  ? formatDisplayDate(new Date(report.submittedAt).toISOString().slice(0, 10))
                  : "Recorded when you submit"}
              </dd>
            </div>
          </dl>
        </Section>
      </fieldset>
      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm"
          id={`${id}-error`}
          ref={errorRef}
          role="alert"
          tabIndex={-1}
        >
          {error} Your unsaved draft is retained in this browser tab.
        </p>
      ) : null}
      {message ? (
        <p className="text-brand-dark text-sm" role="status">
          {message}
        </p>
      ) : null}
      {readOnly ? null : (
        <div className="sticky bottom-0 flex flex-wrap gap-3 border-brand-border border-t bg-white py-4">
          <Button
            disabled={pending}
            onClick={() => save(false)}
            surface="staff"
            type="button"
            variant="outline"
          >
            {pending ? "Saving..." : "Save draft"}
          </Button>
          <Button disabled={pending} surface="staff" type="submit">
            Submit report
          </Button>
          <p className="w-full text-brand-muted text-xs">
            Submit shares the report with CRM staff and alerts only the selected Directors, Finance
            Head and related Sales/Contracting people. Drafts send no alert.
          </p>
        </div>
      )}
    </form>
  );
}

export function StructuredPostTourReport({
  workspace,
}: {
  workspace: Workspace | null | undefined;
}) {
  const archive = useMutation(api.crm.postTourReports.archive);
  const saveDraft = useMutation(api.crm.postTourReports.saveDraft);
  const submitReport = useMutation(api.crm.postTourReports.submit);
  const { confirm } = usePortalConfirm();
  const [epoch, setEpoch] = useState(0);
  const [error, setError] = useState("");
  const archiveReport = async (item: Report, restore = false) => {
    setError("");
    try {
      await confirm({
        confirmLabel: restore ? "Restore report" : "Archive report",
        danger: !restore,
        message: restore
          ? "Restore this report to its previous state. This sends no new submission alert."
          : "Hide this report from normal views and stop queued submission alerts. Admin can restore it; nothing is permanently deleted.",
        onConfirm: async () => {
          await archive({ expectedRevision: item.revision, reportId: item.id, restore });
          if (workspace) {
            draftCache.delete(`${workspace.viewerKey}:${workspace.jobCardId}`);
          }
          setEpoch((value) => value + 1);
        },
        title: restore ? "Restore internal report?" : "Archive internal report?",
      });
    } catch {
      setError("The report could not be archived or restored. It has not been removed.");
    }
  };
  if (workspace === undefined) {
    return <p role="status">Loading the internal report...</p>;
  }
  if (workspace === null) {
    return (
      <p role="status">Select an available Job Card to read or prepare its internal report.</p>
    );
  }
  const { report } = workspace;
  return (
    <section aria-label="Post-Tour Feedback & Learning Form" className="space-y-5">
      <header className="space-y-2">
        <p className="text-brand-muted text-xs uppercase tracking-wide">
          Citius Holidays · Internal use only
        </p>
        <h2 className="font-heading font-semibold text-2xl text-brand-dark">
          Post-Tour Feedback & Learning Form
        </h2>
        <p className="text-brand-muted text-sm">
          {workspace.jobCode} · Operations, Tour Managers and Management · About 5–7 minutes on a
          phone
        </p>
        <p className="text-brand-muted text-sm">
          {report?.status === "submitted"
            ? "Submitted report. All CRM staff can read this snapshot."
            : "Save a private draft or submit the completed report. This is separate from traveller feedback."}
        </p>
      </header>
      {report?.canArchive ? (
        <Button
          onClick={() => archiveReport(report)}
          surface="staff"
          type="button"
          variant="outline"
        >
          Archive report
        </Button>
      ) : null}
      {report || workspace.canPrepare ? (
        <PostTourReportForm
          key={`${workspace.viewerKey}:${workspace.jobCardId}:${report?.status === "submitted" ? "submitted" : "editing"}:${epoch}`}
          onSaveDraft={saveDraft}
          onSubmitReport={submitReport}
          readOnly={!workspace.canPrepare || report?.status === "submitted"}
          report={report}
          viewerKey={workspace.viewerKey}
          workspace={workspace}
        />
      ) : (
        <p className="text-brand-muted text-sm">
          No submitted report yet. Only the assigned Tour Manager, assigned Operations owner or
          Operations Head can prepare it.
        </p>
      )}
      {error ? <p role="alert">{error}</p> : null}
      {workspace.archived.length ? (
        <details className="border-brand-border border-t pt-4">
          <summary className="cursor-pointer text-sm">Archived reports, Admin only</summary>
          <ul className="mt-3 space-y-3">
            {workspace.archived.map((item) => (
              <li className="space-y-3" key={item.id}>
                <span className="text-sm">
                  {item.preparedBy} · {item.content.tour.client}
                </span>
                <details>
                  <summary className="cursor-pointer text-sm">Read archived report</summary>
                  <PostTourReportForm
                    key={item.id}
                    onSaveDraft={saveDraft}
                    onSubmitReport={submitReport}
                    readOnly
                    report={item}
                    viewerKey={workspace.viewerKey}
                    workspace={workspace}
                  />
                </details>
                <Button
                  onClick={() => archiveReport(item, true)}
                  surface="staff"
                  type="button"
                  variant="outline"
                >
                  Restore report
                </Button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
