"use client";

import {
  type PostTourReportContent,
  REPORT_HITS,
  REPORT_MISSES,
  REPORT_PERFORMANCE,
  REPORT_PROGRAMMES,
  reportNeedsClosureDetails,
} from "@convex/lib/postTourReportContent";
import { PortalDateInput } from "@/components/portal/PortalDateInput";
import { inputVariants } from "@/components/ui/application-field-variants";
import { formatDisplayDate } from "@/lib/formatDate";
import { CheckList, Choices, Comment, Field, Section } from "./PostTourReportFields";
import type { ReportView } from "./usePostTourReportDraft";

const fieldClass = inputVariants({ surface: "staff" });
const FIVE_POINTS = [1, 2, 3, 4, 5];
const TEN_POINTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const TOUR_TEXT_FIELDS = [
  ["client", "Client / Company *"],
  ["destination", "Destination *"],
  ["startDate", "Tour start date *"],
  ["endDate", "Tour end date *"],
  ["tourManager", "Tour Manager *"],
] as const;
const CLOSURE_QUESTIONS = [
  ["additionalCost", "Unexpected additional cost?"],
  ["budgetVariation", "Cost variation against approved budget?"],
  ["refundPending", "Refund or recovery pending?"],
] as const;

type Supplier = PostTourReportContent["suppliers"][number];

/** `content` is what the fields show; edits always build on the live `draft`. */
interface ReportSectionProps {
  change: (next: PostTourReportContent) => void;
  content: PostTourReportContent;
  draft: PostTourReportContent;
}

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
function supplierRating(value: string): Supplier["rating"] {
  if (value === "na") {
    return "na";
  }
  return value ? Number(value) : null;
}
function optionalNumber(value: string) {
  return value ? Number(value) : null;
}
/** A score of 1 or 2 asks for a follow-up; other scores drop any earlier one. */
function needsSupplierFollowUp(rating: Supplier["rating"]) {
  return rating !== "na" && rating !== null && rating <= 2;
}
function rateSupplier(row: Supplier, rating: Supplier["rating"]): Supplier {
  return { ...row, followUp: needsSupplierFollowUp(rating) ? row.followUp : "", rating };
}

function RatingOptions({ points }: { points: number[] }) {
  return points.map((value) => (
    <option key={value} value={value}>
      {value}
      {ratingCaption(value)}
    </option>
  ));
}

export function TourDetailsSection({
  change,
  content,
  draft,
  idPrefix,
}: ReportSectionProps & { idPrefix: string }) {
  const tour = (key: keyof PostTourReportContent["tour"], value: string | number | null) =>
    change({ ...draft, tour: { ...draft.tour, [key]: value } });
  return (
    <Section number={1} title="Tour details">
      <div className="grid gap-4 sm:grid-cols-2">
        {TOUR_TEXT_FIELDS.map(([key, label]) => (
          <Field key={key} label={label}>
            {key === "startDate" || key === "endDate" ? (
              <PortalDateInput
                aria-label={label}
                id={`${idPrefix}-${key}`}
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
            onChange={(event) => tour("guests", optionalNumber(event.target.value))}
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
  );
}

export function PerformanceSection({ change, content, draft }: ReportSectionProps) {
  return (
    <Section number={2} title="Overall tour performance">
      <p className="text-brand-muted text-sm">Rate each question from 1, Poor, to 5, Excellent.</p>
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
                    [key]: optionalNumber(event.target.value),
                  },
                })
              }
              value={content.performance[key] ?? ""}
            >
              <option value="">Choose a rating...</option>
              <RatingOptions points={FIVE_POINTS} />
            </select>
          </Field>
        ))}
      </div>
      <Comment
        label="What were the three biggest highlights of the tour?"
        onChange={(highlights) => change({ ...draft, highlights })}
        required
        value={content.highlights}
      />
    </Section>
  );
}

export function HitMissSection({ change, content, draft }: ReportSectionProps) {
  const hasMisses = content.misses.length > 0;
  return (
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
        onChange={(issue) => change({ ...draft, issue })}
        required={hasMisses}
        value={content.issue}
      />
      <Comment
        label="How was the issue resolved?"
        onChange={(resolution) => change({ ...draft, resolution })}
        required={hasMisses}
        value={content.resolution}
      />
      <Comment
        label="What should we do differently next time?"
        onChange={(nextTime) => change({ ...draft, nextTime })}
        required={hasMisses}
        value={content.nextTime}
      />
    </Section>
  );
}

function SupplierRow({
  index,
  onChange,
  supplier,
}: {
  index: number;
  onChange: (index: number, update: (row: Supplier) => Supplier) => void;
  supplier: Supplier;
}) {
  return (
    <div className="space-y-3 border-brand-border border-b pb-4">
      <Field label={supplier.category}>
        <select
          className={`${fieldClass} max-w-xs bg-white`}
          onChange={(event) => {
            const rating = supplierRating(event.target.value);
            onChange(index, (row) => rateSupplier(row, rating));
          }}
          value={supplier.rating ?? ""}
        >
          <option value="">Choose...</option>
          <RatingOptions points={FIVE_POINTS} />
          <option value="na">N.A.</option>
        </select>
      </Field>
      {needsSupplierFollowUp(supplier.rating) ? (
        <Comment
          label={`${supplier.category}: What went wrong, and would you recommend this supplier for future groups?`}
          onChange={(followUp) => onChange(index, (row) => ({ ...row, followUp }))}
          required
          value={supplier.followUp}
        />
      ) : null}
    </div>
  );
}

export function SupplierSection({ change, content, draft }: ReportSectionProps) {
  const updateSupplier = (index: number, update: (row: Supplier) => Supplier) =>
    change({
      ...draft,
      suppliers: draft.suppliers.map((row, i) => (i === index ? update(row) : row)),
    });
  return (
    <Section number={4} title="Supplier performance">
      <p className="text-brand-muted text-sm">
        Choose 1 to 5, or N.A. A score of 1 or 2 needs a short follow-up.
      </p>
      <div className="space-y-4">
        {content.suppliers.map((supplier, index) => (
          <SupplierRow
            index={index}
            key={supplier.category}
            onChange={updateSupplier}
            supplier={supplier}
          />
        ))}
      </div>
    </Section>
  );
}

export function ClosureSection({ change, content, draft }: ReportSectionProps) {
  const closure = (next: Partial<PostTourReportContent["closure"]>) =>
    change({ ...draft, closure: { ...draft.closure, ...next } });
  return (
    <Section number={5} title="Financial and operational closure">
      <div className="grid gap-4 sm:grid-cols-2">
        {CLOSURE_QUESTIONS.map(([key, label]) => (
          <Choices
            key={key}
            label={label}
            onChange={(value) => closure({ [key]: yesNoAnswer(value) })}
            options={["No", "Yes"]}
            value={content.closure[key]}
          />
        ))}
        <Choices
          label="Billing and supplier closure completed?"
          onChange={(value) => closure({ billing: billingAnswer(value) })}
          options={["Completed", "Pending"]}
          value={content.closure.billing}
        />
      </div>
      {reportNeedsClosureDetails(content.closure) ? (
        <Comment
          label="Amount, reason and responsible person for anything additional or pending"
          onChange={(pendingDetails) => closure({ pendingDetails })}
          required
          value={content.closure.pendingDetails}
        />
      ) : null}
    </Section>
  );
}

function submissionDate(report: ReportView | null) {
  return report?.submittedAt
    ? formatDisplayDate(new Date(report.submittedAt).toISOString().slice(0, 10))
    : "Recorded when you submit";
}

export function AssessmentSection({
  change,
  content,
  draft,
  report,
  viewerName,
}: ReportSectionProps & { report: ReportView | null; viewerName: string }) {
  const assessment = (next: Partial<PostTourReportContent["assessment"]>) =>
    change({ ...draft, assessment: { ...draft.assessment, ...next } });
  return (
    <Section number={6} title="Final assessment and ownership">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Overall tour rating, 1 to 10">
          <select
            className={`${fieldClass} bg-white`}
            onChange={(event) => assessment({ rating: optionalNumber(event.target.value) })}
            value={content.assessment.rating ?? ""}
          >
            <option value="">Choose...</option>
            {TEN_POINTS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>
        <Choices
          label="Overall status"
          onChange={(status) => assessment({ status })}
          options={["Excellent", "Good", "Needs Improvement"]}
          value={content.assessment.status}
        />
        <Choices
          label="Repeat this destination and itinerary for a similar group?"
          onChange={(repeat) => assessment({ repeat })}
          options={["Yes", "Yes, with changes", "No"]}
          value={content.assessment.repeat}
        />
      </div>
      <Comment
        label="Top three learnings for future trips"
        onChange={(learnings) => assessment({ learnings })}
        required
        value={content.assessment.learnings}
      />
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-brand-muted">Prepared by</dt>
          <dd>{report?.preparedBy ?? viewerName}</dd>
        </div>
        <div>
          <dt className="text-brand-muted">Date of submission</dt>
          <dd>{submissionDate(report)}</dd>
        </div>
      </dl>
    </Section>
  );
}
