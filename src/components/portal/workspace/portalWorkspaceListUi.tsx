"use client";

import { FileText, Paperclip, Trash2 } from "lucide-react";
import { type ComponentType, type ReactNode, useCallback } from "react";
import { formatDate } from "@/components/portal/PortalModalForm";
import { usePortalToast } from "@/components/portal/PortalToast";
import { PortalTooltip } from "@/components/portal/PortalTooltip";
import { Button } from "@/components/ui/application-button";
import { Badge as ApplicationBadge } from "@/components/ui/application-status";
import { displayPortalTerm } from "@/lib/portal/productTerminology";
import {
  getStatusPresentation,
  type SemanticTone,
  type StatusDomain,
} from "@/lib/portal/statusTones";
import { hasOwnKey } from "@/lib/runtimeValues";
import type { QueriesViewProps } from "./portalViewTypes";
import { openFinalizedProposalPdf, openQueryAttachment } from "./portalWorkspaceListHelpers";

const BADGE_TONES = {
  amber: "bg-citius-orange/15 text-amber-700",
  blue: "bg-citius-blue/10 text-citius-blue",
  gray: "bg-brand-light text-brand-muted",
  green: "bg-citius-green/15 text-emerald-700",
  purple: "bg-violet-50 text-violet-700",
  red: "bg-red-50 text-red-700",
} satisfies Record<string, string>;

interface BadgeProps {
  label: ReactNode;
  meaning?: string;
  semanticTone?: SemanticTone;
  tone?: string;
}

export function Badge({ label, meaning, semanticTone, tone = "gray" }: BadgeProps) {
  const labelText = String(label ?? "");
  const accessibleLabel = meaning && meaning !== labelText ? meaning : labelText;
  const badge = (
    <ApplicationBadge
      aria-label={accessibleLabel}
      className={`border-0 font-semibold text-[length:var(--portal-label-size)] ${hasOwnKey(BADGE_TONES, tone) ? BADGE_TONES[tone] : BADGE_TONES.gray}`}
      data-status-tone={semanticTone}
      role="status"
    >
      {label}
    </ApplicationBadge>
  );
  return meaning && meaning !== labelText ? (
    <PortalTooltip content={meaning}>{badge}</PortalTooltip>
  ) : (
    badge
  );
}

interface StatusBadgeProps {
  domain: StatusDomain;
  label?: string;
  status: string | null | undefined;
}

export function StatusBadge({ domain, label, status }: StatusBadgeProps) {
  const presentation = getStatusPresentation(domain, status);
  const displayLabel = displayPortalTerm(label ?? status) || "—";
  return (
    <Badge
      label={displayLabel}
      meaning={presentation.meaning}
      semanticTone={presentation.semanticTone}
      tone={presentation.badgeTone}
    />
  );
}

export function FinalizedProposalPdfSummary({ finalizedPdf, canSend, onManage, onDownload }: any) {
  const toast = usePortalToast();
  const handleDownload = useCallback(() => {
    onDownload().catch((err: any) => {
      toast.error(err?.data || err?.message || "Unable to open file.");
    });
  }, [onDownload, toast]);
  if (!finalizedPdf) {
    return canSend ? (
      <Button className="portal-small-btn" onClick={onManage} type="button">
        Upload document
      </Button>
    ) : (
      <span className="text-brand-muted text-xs">Not uploaded</span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        className="inline-flex max-w-[180px] items-center gap-1 truncate text-left font-medium text-citius-blue text-xs hover:underline"
        onClick={handleDownload}
        type="button"
      >
        <FileText className="shrink-0" size={12} />
        <span className="truncate">{finalizedPdf.fileName}</span>
      </Button>
      {finalizedPdf.uploadedAt ? (
        <span className="text-[length:var(--portal-label-size)] text-brand-muted">
          {formatDate(finalizedPdf.uploadedAt)}
        </span>
      ) : null}
      {canSend ? (
        <Button className="portal-small-btn mt-1 w-fit" onClick={onManage} type="button">
          Replace document
        </Button>
      ) : null}
    </div>
  );
}

function QueryAttachmentButton({
  attachmentKind,
  file,
  getQueryAttachmentUrl,
}: {
  attachmentKind: "proposal" | "query";
  file: { fileName: string; id: string };
  getQueryAttachmentUrl: QueriesViewProps["getQueryAttachmentUrl"];
}) {
  const toast = usePortalToast();
  const handleOpen = useCallback(() => {
    openQueryAttachment(file.id, getQueryAttachmentUrl, attachmentKind).catch((err: any) => {
      toast.error(err?.data || err?.message || "Unable to open file.");
    });
  }, [attachmentKind, file.id, getQueryAttachmentUrl, toast]);
  return (
    <Button
      className="inline-flex max-w-[180px] items-center gap-1 truncate text-left font-medium text-citius-blue text-xs hover:underline"
      onClick={handleOpen}
      type="button"
    >
      <Paperclip className="shrink-0" size={12} />
      <span className="truncate">{file.fileName}</span>
    </Button>
  );
}

export function QueryFilesSummary({
  attachments,
  canManageReferenceItinerary,
  proposalDocument,
  getQueryAttachmentUrl,
  getFinalizedPdfUrl,
  onManageReferenceItinerary,
}: {
  attachments: Array<{ fileName: string; id: string }>;
  canManageReferenceItinerary?: boolean;
  getFinalizedPdfUrl: QueriesViewProps["getFinalizedPdfUrl"];
  getQueryAttachmentUrl: QueriesViewProps["getQueryAttachmentUrl"];
  onManageReferenceItinerary?: () => void;
  proposalDocument?: {
    fileName: string;
    proposalId: string;
    uploadedAt?: string | null;
  } | null;
}) {
  const toast = usePortalToast();
  const hasReferenceItinerary = attachments.length > 0 || canManageReferenceItinerary;
  const hasProposalDocument = Boolean(proposalDocument?.proposalId);
  const handleProposalDownload = useCallback(() => {
    if (!proposalDocument?.proposalId) {
      return;
    }
    openFinalizedProposalPdf(proposalDocument.proposalId, getFinalizedPdfUrl).catch((err: any) => {
      toast.error(err?.data || err?.message || "Unable to open file.");
    });
  }, [getFinalizedPdfUrl, proposalDocument, toast]);

  if (!(hasReferenceItinerary || hasProposalDocument)) {
    return <span className="text-brand-muted text-xs">-</span>;
  }

  return (
    <div className="flex min-w-44 flex-col gap-3">
      {hasReferenceItinerary ? (
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-[length:var(--portal-label-size)] text-brand-muted uppercase tracking-[0.08em]">
            Reference itinerary
          </span>
          {attachments.slice(0, 2).map((file) => (
            <QueryAttachmentButton
              attachmentKind="query"
              file={file}
              getQueryAttachmentUrl={getQueryAttachmentUrl}
              key={file.id}
            />
          ))}
          {canManageReferenceItinerary && onManageReferenceItinerary ? (
            <Button
              className="portal-small-btn mt-1 w-fit"
              onClick={onManageReferenceItinerary}
              type="button"
            >
              {attachments.length > 0 ? "Manage" : "Add file"}
            </Button>
          ) : null}
        </div>
      ) : null}
      {proposalDocument?.proposalId ? (
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-[length:var(--portal-label-size)] text-brand-muted uppercase tracking-[0.08em]">
            Proposal doc
          </span>
          <Button
            className="inline-flex max-w-[180px] items-center gap-1 truncate text-left font-medium text-citius-blue text-xs hover:underline"
            onClick={handleProposalDownload}
            type="button"
          >
            <FileText className="shrink-0" size={12} />
            <span className="truncate">{proposalDocument.fileName}</span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function QueryAttachmentSummary({
  attachmentCount,
  attachments,
  canManage,
  onManage,
  getQueryAttachmentUrl,
  attachmentKind = "query",
}: any) {
  const totalAttachments = Math.max(attachmentCount ?? 0, attachments.length);
  if (totalAttachments === 0) {
    return canManage ? (
      <Button className="portal-small-btn" onClick={onManage} type="button">
        Add files
      </Button>
    ) : (
      <span className="text-brand-muted text-xs">-</span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {attachments.slice(0, 2).map((file: any) => (
        <QueryAttachmentButton
          attachmentKind={attachmentKind}
          file={file}
          getQueryAttachmentUrl={getQueryAttachmentUrl}
          key={file.id}
        />
      ))}
      {totalAttachments > attachments.slice(0, 2).length && (
        <span className="text-[length:var(--portal-label-size)] text-brand-muted">
          +{totalAttachments - attachments.slice(0, 2).length} more
        </span>
      )}
      {canManage ? (
        <Button className="portal-small-btn mt-1 w-fit" onClick={onManage} type="button">
          Manage
        </Button>
      ) : null}
    </div>
  );
}

export function EditButton({ className, onClick, label = "Edit", ...buttonProps }: any) {
  return (
    <Button
      {...buttonProps}
      className={className || "portal-small-btn"}
      onClick={onClick}
      type="button"
    >
      {label}
    </Button>
  );
}

export function DeleteButton({ className, label, onClick, ...buttonProps }: any) {
  return (
    <Button
      {...buttonProps}
      aria-label={`Delete ${label}`}
      className={className || "portal-danger-btn"}
      onClick={onClick}
      type="button"
    >
      <Trash2 size={13} />
      Delete
    </Button>
  );
}

export function Panel({ title, subtitle = "", children, className = "", action }: any) {
  return (
    <section
      className={`rounded-2xl border border-brand-border/70 bg-white/95 p-4 shadow-[0_12px_34px_rgba(16,42,131,0.045)] md:p-5 ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading font-semibold text-brand-dark text-sm">{title}</h2>
          {subtitle ? <p className="mt-1 text-brand-muted text-xs">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DashboardSectionHeading({ title, detail }: { detail?: string; title: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <h3 className="font-heading font-semibold text-brand-dark text-sm tracking-wide">{title}</h3>
      {detail ? <p className="text-brand-muted text-xs">{detail}</p> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  Icon,
  featured = false,
}: {
  Icon: ComponentType<{ size?: number }>;
  featured?: boolean;
  label: string;
  value: ReactNode;
}) {
  return (
    <div
      className={`min-h-32 overflow-hidden rounded-xl border border-brand-border bg-white p-4 shadow-brand-dark/[0.03] shadow-sm transition-shadow hover:border-citius-orange/30 hover:shadow-md ${
        featured ? "border-l-4 border-l-citius-orange" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="max-w-[8rem] font-medium text-brand-dark text-xs leading-tight">
          {label}
        </div>
        <div
          className={`shrink-0 rounded-lg p-1.5 ${
            featured ? "bg-citius-blue/10 text-citius-blue" : "bg-citius-blue/5 text-citius-blue"
          }`}
        >
          <Icon size={17} />
        </div>
      </div>
      <div className="mt-3 font-heading font-semibold text-3xl text-brand-dark tabular-nums leading-none">
        {value}
      </div>
    </div>
  );
}
