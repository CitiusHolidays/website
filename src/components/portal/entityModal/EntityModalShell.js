"use client";

import { CheckCircle2, Loader2, X } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { LifecycleDates } from "@/components/portal/PortalModalForm";
import {
  getEntityModalFieldColumns,
  getEntityModalMaxWidthClass,
  getEntityModalSize,
} from "@/lib/portal/entityModalLayout";
import { portalMotionTransition } from "@/lib/portal/portalMotion";
import { PORTAL_Z } from "@/lib/portal/zIndex";
import { EntityModalFieldSection } from "./EntityModalFieldSection";
import { EntityModalFieldsPrimary } from "./EntityModalFieldsPrimary";
import { EntityModalFieldsSecondary } from "./EntityModalFieldsSecondary";
import { getEntityModalSectionMeta } from "./entityModalSectionMeta";

export function EntityModalShell({
  modal,
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
  const shouldReduceMotion = useReducedMotion();
  const modalTransition = portalMotionTransition(shouldReduceMotion, 0.25);
  const errorTransition = portalMotionTransition(shouldReduceMotion, 0.16);
  const formRef = useRef(null);
  const errorRef = useRef(null);
  const modalTransform = "translateY(0) scale(1)";
  const modalHiddenTransform = shouldReduceMotion
    ? modalTransform
    : "translateY(24px) scale(0.98)";

  useEffect(() => {
    if (!modal) {
      return;
    }

    const previouslyFocused = document.activeElement;
    const frame = requestAnimationFrame(() => {
      const preferredTarget = formRef.current?.querySelector(
        "[data-entity-modal-autofocus], input:not([type='hidden']):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)"
      );
      preferredTarget?.focus({ preventScroll: true });
    });

    return () => {
      cancelAnimationFrame(frame);
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [modal]);

  useEffect(() => {
    if (!error) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      errorRef.current?.focus({ preventScroll: true });
      errorRef.current?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [error]);

  const handleDialogKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }

    const focusable = Array.from(
      formRef.current?.querySelectorAll(
        "a[href], button:not(:disabled), input:not([type='hidden']):not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])"
      ) || []
    ).filter((element) => element.getClientRects().length > 0);
    if (focusable.length === 0) {
      return;
    }

    const [first] = focusable;
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const isQueryTaskSheet = modal === "query";
  const sectionMeta = getEntityModalSectionMeta(modal);
  const modalMaxWidthClass = getEntityModalMaxWidthClass(modal);
  const fieldColumns = getEntityModalFieldColumns(modal);
  const isCompactModal = getEntityModalSize(modal) === "compact";

  const fieldBody = (
    <>
      <EntityModalFieldsPrimary {...primaryProps} />
      <EntityModalFieldsSecondary {...secondaryProps} />
    </>
  );

  return (
    <AnimatePresence>
      {modal && (
        <m.div
          animate={{ opacity: 1 }}
          className={`fixed inset-0 ${PORTAL_Z.entityModal} grid place-items-center bg-slate-950/65 p-4`}
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          key={modal}
          onClick={close}
        >
          <m.form
            animate={{ opacity: 1, transform: modalTransform }}
            aria-describedby={error ? "portal-entity-modal-error" : undefined}
            aria-labelledby="portal-entity-modal-title"
            aria-modal="true"
            className={`flex max-h-[90vh] w-full ${modalMaxWidthClass} flex-col overflow-hidden overscroll-contain rounded-2xl border border-brand-border bg-white shadow-2xl ${
              isCompactModal
                ? "max-sm:max-h-[min(85dvh,100%)] max-sm:rounded-2xl"
                : "max-sm:fixed max-sm:inset-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:max-w-none max-sm:rounded-none"
            }`}
            data-testid="portal-entity-modal"
            exit={{ opacity: 0, transform: modalHiddenTransform }}
            initial={{ opacity: 0, transform: modalHiddenTransform }}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={handleDialogKeyDown}
            onSubmit={submit}
            ref={formRef}
            role="dialog"
            transition={modalTransition}
          >
            <div className="flex shrink-0 items-center justify-between gap-4 border-brand-border border-b bg-white px-5 py-4 max-sm:px-4">
              <div>
                <div
                  className="font-heading font-semibold text-citius-blue text-lg"
                  id="portal-entity-modal-title"
                >
                  {title}
                </div>
                {isQueryTaskSheet ? (
                  <p className="mt-0.5 text-brand-muted text-xs">
                    Capture the client, trip brief, and delivery handoff.
                  </p>
                ) : null}
              </div>
              <button
                aria-label="Close dialog"
                className="grid size-11 shrink-0 place-items-center rounded-full text-brand-muted transition-colors hover:bg-brand-light hover:text-brand-dark"
                onClick={close}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 max-sm:px-4 max-sm:py-5">
              <AnimatePresence>
                {error ? (
                  <m.div
                    animate={{ opacity: 1, transform: "translateY(0)" }}
                    aria-live="assertive"
                    className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm outline-none focus:ring-2 focus:ring-red-300"
                    exit={{
                      opacity: 0,
                      transform: shouldReduceMotion ? "translateY(0)" : "translateY(-4px)",
                    }}
                    id="portal-entity-modal-error"
                    initial={{
                      opacity: 0,
                      transform: shouldReduceMotion ? "translateY(0)" : "translateY(-4px)",
                    }}
                    key="entity-modal-error"
                    ref={errorRef}
                    role="alert"
                    tabIndex={-1}
                    transition={errorTransition}
                  >
                    {error}
                  </m.div>
                ) : null}
              </AnimatePresence>
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
                    { label: "Sales handoff", value: lifecycleProposal.sentToSalesAt },
                    { label: "Client delivery", value: lifecycleProposal.sentToClientAt },
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
              {isQueryTaskSheet || !sectionMeta ? (
                <div className="grid gap-4 md:grid-cols-2">{fieldBody}</div>
              ) : isCompactModal ? (
                <div className="grid grid-cols-1 gap-4">{fieldBody}</div>
              ) : (
                <EntityModalFieldSection
                  columns={fieldColumns}
                  description={sectionMeta.description}
                  eyebrow={sectionMeta.eyebrow}
                  title={sectionMeta.title}
                >
                  {fieldBody}
                </EntityModalFieldSection>
              )}
            </div>
            <div className="flex shrink-0 justify-end gap-3 border-brand-border border-t bg-white px-5 py-4 max-sm:grid max-sm:grid-cols-2 max-sm:px-4 max-sm:pb-[max(1rem,var(--safe-area-inset-bottom))]">
              <button
                className="portal-outline-btn max-sm:w-full"
                data-testid="portal-entity-modal-cancel"
                onClick={close}
                type="button"
              >
                {["queryAttachments", "proposalAttachments", "proposalFinalizedPdf"].includes(modal)
                  ? "Close"
                  : "Cancel"}
              </button>
              {!["queryAttachments", "proposalAttachments", "proposalFinalizedPdf"].includes(
                modal
              ) && (
                <button
                  className="portal-primary-btn disabled:opacity-60 max-sm:w-full"
                  data-testid="portal-entity-modal-save"
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  {isQueryTaskSheet ? "Save query" : "Save"}
                </button>
              )}
            </div>
          </m.form>
        </m.div>
      )}
    </AnimatePresence>
  );
}
