import {
  formatJobCardDeletionCount,
  humanizeJobCardDeletionStage,
} from "@/lib/portal/jobCardDeletionPresentation";
import type { PortalJobCardDeletionOperation } from "../portalViewTypes";

const MAX_VISIBLE_OPERATIONS = 3;

function statusPanelClass(status: PortalJobCardDeletionOperation["status"]) {
  if (status === "failed") {
    return "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-950 text-sm";
  }
  if (status === "complete") {
    return "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950 text-sm";
  }
  return "rounded-xl border border-brand-border bg-brand-light/50 px-4 py-3 text-brand-muted text-sm";
}

function operationMessage(operation: PortalJobCardDeletionOperation) {
  const stageLabel = humanizeJobCardDeletionStage(operation.stage);
  const deletedLabel = formatJobCardDeletionCount(operation.deletedCount);

  if (operation.status === "running") {
    if (operation.stalled) {
      return (
        <>
          Deletion for <span className="font-semibold text-brand-dark">{operation.jobCode}</span>{" "}
          has not advanced recently. {deletedLabel}. Contact an admin to retry the cleanup safely.
        </>
      );
    }
    return (
      <>
        Deletion for <span className="font-semibold text-brand-dark">{operation.jobCode}</span>{" "}
        continues safely in the background. Currently cleaning {stageLabel.toLowerCase()} (
        {deletedLabel}).
      </>
    );
  }

  if (operation.status === "complete") {
    return (
      <>
        Cleanup for <span className="font-semibold text-brand-dark">{operation.jobCode}</span>{" "}
        finished. {deletedLabel}.
      </>
    );
  }

  return (
    <>
      Cleanup for <span className="font-semibold text-brand-dark">{operation.jobCode}</span>{" "}
      stopped.
      {operation.failureSummary ? (
        <>
          {" "}
          <span className="font-medium">{operation.failureSummary}</span>
        </>
      ) : null}{" "}
      Contact an admin to retry the cleanup safely.
    </>
  );
}

export function JobCardDeletionStatusRegion({
  operations,
}: {
  operations?: PortalJobCardDeletionOperation[];
}) {
  const visible = (operations ?? []).slice(0, MAX_VISIBLE_OPERATIONS);
  if (!visible.length) {
    return null;
  }

  return (
    <section aria-label="Job card deletion progress" className="mb-4 space-y-2">
      {visible.map((operation) => (
        <div
          aria-live={operation.status === "running" ? "polite" : undefined}
          className={statusPanelClass(operation.status)}
          key={operation.id}
          role="status"
        >
          {operationMessage(operation)}
        </div>
      ))}
    </section>
  );
}
