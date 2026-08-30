"use client";

import { X } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { MultiStateButton } from "@/components/motion-ui/multi-state-button";
import { useDocumentPreviewActive } from "@/components/portal/document-preview/DocumentPreviewHost";
import { usePortalConfirmActive } from "@/components/portal/PortalConfirmDialog";
import { LifecycleDates } from "@/components/portal/PortalModalForm";
import { Button } from "@/components/ui/application-button";
import {
  ControlledDialog,
  ControlledDialogClose,
  ControlledDialogTitle,
} from "@/components/ui/application-dialog";
import {
  getEntityModalFieldColumns,
  getEntityModalMaxWidthClass,
  getEntityModalSize,
} from "@/lib/portal/entityModalLayout";
import { portalMotionTransition } from "@/lib/portal/portalMotion";
import { PORTAL_Z } from "@/lib/portal/zIndex";
import { EntityModalFieldsPrimary } from "./EntityModalFieldsPrimary";
import { EntityModalFieldsSecondary } from "./EntityModalFieldsSecondary";
import { getEntityModalSectionMeta } from "./entityModalSectionMeta";

function resolveSaveButtonState({ error, isSaving, saveFlash }) {
  if (error) {
    return "error";
  }
  if (isSaving) {
    return "saving";
  }
  return saveFlash ? "saved" : "idle";
}

function renderFieldContent({ fieldBody, fieldColumns, isDetailLoading, isDetailMissing }) {
  if (isDetailLoading) {
    return (
      <div
        aria-live="polite"
        className="rounded-xl border border-brand-border bg-brand-light/40 px-4 py-8 text-center text-brand-muted text-sm"
        role="status"
      >
        Loading the current record…
      </div>
    );
  }
  if (isDetailMissing) {
    return (
      <div
        className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-red-700 text-sm"
        role="alert"
      >
        This record is no longer available or you do not have access.
      </div>
    );
  }
  return (
    <div className={fieldColumns === 1 ? "grid grid-cols-1 gap-4" : "grid gap-4 md:grid-cols-2"}>
      {fieldBody}
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: modal lifecycle behavior is intentionally centralized.
export function EntityModalShell({
  modal,
  submit,
  close,
  detailState,
  error,
  fieldErrors = {},
  isSaving,
  saveFlash = false,
  title,
  lifecycleQuery,
  lifecycleProposal,
  lifecycleJobCard,
  primaryProps,
  secondaryProps,
}) {
  const shouldReduceMotion = useReducedMotion();
  const confirmActive = usePortalConfirmActive();
  const documentPreviewActive = useDocumentPreviewActive();
  const errorTransition = portalMotionTransition(shouldReduceMotion, 0.16);
  const formRef = useRef(null);
  const errorRef = useRef(null);
  const fieldErrorSignature = JSON.stringify(fieldErrors);

  const saveButtonState = resolveSaveButtonState({ error, isSaving, saveFlash });
  const actionLocked = isSaving || saveFlash;
  const nestedOverlayActive = confirmActive || documentPreviewActive;

  useEffect(() => {
    if (!error) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      errorRef.current?.focus({ preventScroll: true });
      errorRef.current?.scrollIntoView?.({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [error]);

  useEffect(() => {
    if (fieldErrorSignature === "{}") {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const invalidField = formRef.current?.querySelector(
        '[aria-invalid="true"]:not([aria-hidden="true"]):not([type="hidden"])'
      );
      invalidField?.focus({ preventScroll: true });
      invalidField?.scrollIntoView?.({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [fieldErrorSignature]);

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) {
      close();
    }
  };
  const resolveInitialFocus = () => {
    const popup = formRef.current;
    return (
      popup?.querySelector(
        "[data-entity-modal-autofocus], input:not([type='hidden']):not(:disabled), select:not(:disabled), textarea:not(:disabled)"
      ) || popup
    );
  };
  const isQueryTaskSheet = modal === "query";
  const sectionMeta = getEntityModalSectionMeta(modal);
  const modalMaxWidthClass = getEntityModalMaxWidthClass(modal);
  const fieldColumns = getEntityModalFieldColumns(modal);
  const isCompactModal = getEntityModalSize(modal) === "compact";
  const isDetailLoading = detailState === "loading";
  const isDetailMissing = detailState === "missing";

  const fieldBody = (
    <>
      <EntityModalFieldsPrimary {...primaryProps} />
      <EntityModalFieldsSecondary {...secondaryProps} />
    </>
  );

  return (
    <ControlledDialog
      backdropClassName="portal-entity-modal-backdrop absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
      closeDisabled={nestedOverlayActive || actionLocked}
      initialFocus={resolveInitialFocus}
      modal={!nestedOverlayActive}
      onOpenChange={handleOpenChange}
      open={Boolean(modal)}
      popupClassName={`portal-entity-modal-surface pointer-events-auto relative flex max-h-[90vh] w-full ${modalMaxWidthClass} flex-col overflow-hidden overscroll-contain rounded-[1.75rem] border border-white/70 bg-white shadow-[0_28px_90px_rgba(5,8,20,0.32)] ${
        isCompactModal
          ? "max-sm:max-h-[min(85dvh,100%)] max-sm:rounded-2xl"
          : "max-sm:fixed max-sm:inset-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:max-w-none max-sm:rounded-none"
      }`}
      popupRef={formRef}
      popupRender={
        <form
          aria-describedby={error ? "portal-entity-modal-error" : undefined}
          data-testid="portal-entity-modal"
          inert={documentPreviewActive ? true : undefined}
          onSubmit={submit}
          tabIndex={-1}
        />
      }
      triggerless
      viewportClassName={`fixed inset-0 ${PORTAL_Z.entityModal} grid place-items-center p-4 sm:p-6`}
    >
      {modal ? (
        <>
          <div className="flex shrink-0 items-start justify-between gap-6 border-brand-border/80 border-b bg-white px-6 py-5 max-sm:px-4">
            <div className="min-w-0 pt-0.5">
              <ControlledDialogTitle className="text-balance font-heading font-semibold text-2xl text-citius-blue tracking-tight">
                {title}
              </ControlledDialogTitle>
              {sectionMeta?.description ? (
                <p className="mt-1.5 max-w-3xl text-brand-muted text-sm leading-relaxed">
                  {sectionMeta.description}
                </p>
              ) : null}
            </div>
            <ControlledDialogClose
              render={
                <Button
                  aria-label="Close dialog"
                  className="grid size-11 shrink-0 place-items-center rounded-full text-brand-muted transition-colors hover:bg-brand-light hover:text-brand-dark"
                  disabled={actionLocked}
                  type="button"
                />
              }
            >
              <X aria-hidden="true" size={18} />
            </ControlledDialogClose>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-brand-light/35 p-6 [scrollbar-gutter:stable] max-sm:px-4 max-sm:py-5">
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
                  { label: "Proposal Doc", value: lifecycleProposal.finalizedPdf?.uploadedAt },
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
            {renderFieldContent({
              fieldBody,
              fieldColumns,
              isDetailLoading,
              isDetailMissing,
            })}
          </div>
          <div className="flex shrink-0 justify-end gap-3 border-brand-border/80 border-t bg-white px-6 py-4 max-sm:grid max-sm:grid-cols-2 max-sm:px-4 max-sm:pb-[max(1rem,var(--safe-area-inset-bottom))]">
            <ControlledDialogClose
              render={
                <Button
                  className="portal-outline-btn max-sm:w-full"
                  data-testid="portal-entity-modal-cancel"
                  disabled={actionLocked}
                  type="button"
                />
              }
            >
              {["queryAttachments", "proposalAttachments", "proposalFinalizedPdf"].includes(modal)
                ? "Close"
                : "Cancel"}
            </ControlledDialogClose>
            {!["queryAttachments", "proposalAttachments", "proposalFinalizedPdf"].includes(
              modal
            ) && (
              <MultiStateButton
                className="portal-primary-btn disabled:opacity-60 max-sm:w-full"
                data-testid="portal-entity-modal-save"
                disabled={actionLocked || isDetailLoading || isDetailMissing}
                savedLabel={isQueryTaskSheet ? "Query saved" : "Saved"}
                savingLabel={isQueryTaskSheet ? "Saving query…" : "Saving…"}
                state={saveButtonState}
                type="submit"
              >
                {isQueryTaskSheet ? "Save query" : "Save"}
              </MultiStateButton>
            )}
          </div>
        </>
      ) : null}
    </ControlledDialog>
  );
}
