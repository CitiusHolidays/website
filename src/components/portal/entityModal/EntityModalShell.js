"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { LifecycleDates } from "@/components/portal/PortalModalForm";
import { PORTAL_Z } from "@/lib/portal/zIndex";
import { EntityModalFieldsPrimary } from "./EntityModalFieldsPrimary";
import { EntityModalFieldsSecondary } from "./EntityModalFieldsSecondary";

export function EntityModalShell({
  modal,
  form,
  updateForm,
  patchForm,
  submit,
  close,
  error,
  isSaving,
  title,
  lifecycleQuery,
  lifecycleProposal,
  lifecycleJobCard,
  primaryProps,
  secondaryProps,
}) {
  return (
    <AnimatePresence>
      {modal && (
        <m.div
          animate={{ opacity: 1 }}
          className={`fixed inset-0 ${PORTAL_Z.entityModal} grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm`}
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          key={modal}
          onClick={close}
        >
          <m.form
            animate={{ opacity: 1, scale: 1, y: 0 }}
            aria-labelledby="portal-entity-modal-title"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-brand-border bg-white shadow-2xl max-sm:fixed max-sm:inset-0 max-sm:max-h-none max-sm:max-w-none max-sm:rounded-none"
            exit={{ opacity: 0, scale: 0.98, y: 24 }}
            initial={{ opacity: 0, scale: 0.98, y: 24 }}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                close();
              }
            }}
            onSubmit={submit}
            role="dialog"
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between border-brand-border border-b px-5 py-4">
              <div
                className="font-heading font-semibold text-citius-blue text-lg"
                id="portal-entity-modal-title"
              >
                {title}
              </div>
              <button
                aria-label="Close dialog"
                className="rounded-full p-2 text-brand-muted hover:bg-brand-light"
                onClick={close}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="max-h-[calc(90vh-130px)] overflow-y-auto p-5">
              {error && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm">
                  {error}
                </div>
              )}
              {(modal === "query" || modal === "queryStatus") && lifecycleQuery && (
                <LifecycleDates
                  items={[
                    { label: "Created", value: lifecycleQuery.createdAt },
                    {
                      label: "Submitted to Contracting",
                      value: lifecycleQuery.submittedToContractingAt,
                    },
                    { label: "Confirmed", value: lifecycleQuery.confirmedAt },
                  ]}
                />
              )}
              {modal === "proposal" && lifecycleProposal && (
                <LifecycleDates
                  items={[
                    { label: "Created", value: lifecycleProposal.createdAt },
                    { label: "Sent", value: lifecycleProposal.sentAt },
                    { label: "Finalized PDF", value: lifecycleProposal.finalizedPdf?.uploadedAt },
                  ]}
                />
              )}
              {modal === "jobCard" && lifecycleJobCard && (
                <LifecycleDates
                  items={[
                    { label: "Opened", value: lifecycleJobCard.createdAt },
                    { label: "Last updated", value: lifecycleJobCard.updatedAt },
                  ]}
                />
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <EntityModalFieldsPrimary {...primaryProps} />
                <EntityModalFieldsSecondary {...secondaryProps} />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-brand-border border-t px-5 py-4">
              <button className="portal-outline-btn" onClick={close} type="button">
                {["queryAttachments", "proposalAttachments", "proposalFinalizedPdf"].includes(modal)
                  ? "Close"
                  : "Cancel"}
              </button>
              {!["queryAttachments", "proposalAttachments", "proposalFinalizedPdf"].includes(
                modal
              ) && (
                <button
                  className="portal-primary-btn disabled:opacity-60"
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  Save
                </button>
              )}
            </div>
          </m.form>
        </m.div>
      )}
    </AnimatePresence>
  );
}
