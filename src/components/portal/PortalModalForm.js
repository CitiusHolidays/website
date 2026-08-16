"use client";

import { Loader2 } from "lucide-react";
import { m } from "motion/react";
import { useId, useState } from "react";
import { usePortalConfirm } from "@/components/portal/PortalConfirmDialog";
import { PortalDateInput } from "@/components/portal/PortalDateInput";
import { usePortalToast } from "@/components/portal/PortalToast";
import { Button } from "@/components/ui/application-button";
import { Checkbox } from "@/components/ui/application-checkbox";
import {
  inputVariants,
  Input as StaffInput,
  Textarea as StaffTextarea,
} from "@/components/ui/application-field";
import { Select as StaffSelect } from "@/components/ui/application-select";
import { formatDisplayDate as formatDate } from "@/lib/formatDate";
import { isRuntimeString } from "../../lib/runtimeValues";

function formatFileSize(bytes) {
  if (!bytes) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_QUERY_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const QUERY_ATTACHMENT_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp,.gif";

async function uploadEntityFiles({ entityId, idField, files, generateUploadUrl, attachFile }) {
  const uploadArgs = { [idField]: entityId };
  await Promise.all(
    files.map(async (file) => {
      if (file.size > MAX_QUERY_ATTACHMENT_BYTES) {
        throw new Error(`${file.name} exceeds the 15 MB limit.`);
      }
      const uploadUrl = await generateUploadUrl(uploadArgs);
      const uploadRes = await fetch(uploadUrl, {
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
        method: "POST",
      });
      if (!uploadRes.ok) {
        throw new Error(`Failed to upload ${file.name}.`);
      }
      const { storageId } = await uploadRes.json();
      await attachFile({
        [idField]: entityId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        storageId,
      });
    })
  );
}

function openPortalFile(url) {
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}

async function openQueryAttachment(attachmentId, getQueryAttachmentUrl, kind = "query") {
  void getQueryAttachmentUrl;
  const routeKind = kind === "proposal" ? "proposal" : kind === "expense" ? "expense" : "query";
  openPortalFile(`/api/portal/files/${routeKind}/${encodeURIComponent(attachmentId)}`);
}

async function openFinalizedProposalPdf(proposalId, getFinalizedPdfUrl) {
  void getFinalizedPdfUrl;
  openPortalFile(`/api/portal/files/proposal-finalized/${encodeURIComponent(proposalId)}`);
}

const MAX_QUERY_NOTES_WORDS = 30;

function countWords(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

function truncateToMaxWords(value, maxWords) {
  const words = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length <= maxWords) {
    return value;
  }
  return words.slice(0, maxWords).join(" ");
}

function formatNotesPreview(value, maxWords = MAX_QUERY_NOTES_WORDS) {
  const text = String(value || "").trim();
  if (!text) {
    return "-";
  }
  const words = text.split(/\s+/).filter(Boolean);
  const display = words.length > maxWords ? `${words.slice(0, maxWords).join(" ")}…` : text;
  return (
    <span
      className="block max-w-[220px] whitespace-normal break-words text-brand-muted text-xs leading-snug"
      title={text}
    >
      {display}
    </span>
  );
}

function notesPreview(value) {
  return formatNotesPreview(value);
}

function Input({
  error = "",
  fieldKey = "",
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  id: idProp,
  ...rest
}) {
  const autoId = useId();
  const fieldId = idProp || autoId;
  const errorId = error ? `${fieldId}-error` : undefined;
  if (type === "date") {
    return (
      <label className="block" htmlFor={fieldId}>
        <span className="mb-1 block font-semibold text-brand-muted text-xs">
          {label}
          {required ? (
            <>
              <span aria-hidden="true" className="text-citius-orange-ink">
                {" "}
                *
              </span>
              <span className="sr-only"> required</span>
            </>
          ) : null}
        </span>
        <PortalDateInput
          aria-describedby={errorId}
          aria-invalid={Boolean(error) || undefined}
          className="w-full"
          id={fieldId}
          inputClassName="!bg-brand-light focus:!bg-white"
          onChange={onChange}
          placeholder={placeholder || "DD/MM/YYYY"}
          required={required}
          value={value}
          {...rest}
        />
        {error ? (
          <p className="mt-1 text-red-700 text-xs" id={errorId}>
            {error}
          </p>
        ) : null}
      </label>
    );
  }
  return (
    <label className="block" htmlFor={fieldId}>
      <span className="mb-1 block font-semibold text-brand-muted text-xs">
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="text-citius-orange-ink">
              {" "}
              *
            </span>
            <span className="sr-only"> required</span>
          </>
        ) : null}
      </span>
      <StaffInput
        aria-describedby={errorId}
        aria-invalid={Boolean(error) || undefined}
        data-field-key={fieldKey}
        id={fieldId}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
        {...rest}
      />
      {error ? (
        <p className="mt-1 text-red-700 text-xs" id={errorId}>
          {error}
        </p>
      ) : null}
    </label>
  );
}

function Select({ error = "", fieldKey = "", label, value, options, onChange, required = false }) {
  const fieldId = useId();
  const errorId = error ? `${fieldId}-error` : undefined;
  const normalized = options.map((option) =>
    isRuntimeString(option) ? { label: option, value: option } : option
  );
  return (
    <div className="block">
      <label className="mb-1 block font-semibold text-brand-muted text-xs" htmlFor={fieldId}>
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="text-citius-orange-ink">
              {" "}
              *
            </span>
            <span className="sr-only"> required</span>
          </>
        ) : null}
      </label>
      <StaffSelect
        aria-describedby={errorId}
        aria-invalid={Boolean(error) || undefined}
        className={inputVariants({ surface: "staff" })}
        id={fieldId}
        onValueChange={onChange}
        options={normalized}
        required={required}
        value={value}
      />
      {error ? (
        <p className="mt-1 text-red-700 text-xs" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function MultiSelect({ label, value, options, onChange, help }) {
  const normalized = options.map((option) =>
    isRuntimeString(option) ? { label: option, value: option } : option
  );
  const selected = new Set(value);
  return (
    <div className="md:col-span-2">
      <span className="mb-2 block font-semibold text-brand-muted text-xs">{label}</span>
      {help ? <p className="mb-2 text-brand-muted text-xs leading-relaxed">{help}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {normalized.map((option) => (
          <Checkbox
            aria-label={isRuntimeString(option.label) ? option.label : option.value}
            checked={selected.has(option.value)}
            className="flex items-center gap-2 rounded-md border border-brand-border bg-brand-light px-3 py-2 text-sm"
            key={option.value}
            onCheckedChange={(checked) => {
              const next = new Set(selected);
              if (checked) {
                next.add(option.value);
              } else {
                next.delete(option.value);
              }
              onChange(Array.from(next));
            }}
          >
            {option.label}
          </Checkbox>
        ))}
      </div>
    </div>
  );
}

function Textarea({ error = "", fieldKey = "", label, value, onChange, maxWords }) {
  const fieldId = useId();
  const errorId = error ? `${fieldId}-error` : undefined;
  const wordCount = countWords(value);
  const updateTextareaValue = (event) => {
    let next = event.target.value;
    if (maxWords) {
      next = truncateToMaxWords(next, maxWords);
    }
    onChange(next);
  };

  return (
    <label className="block md:col-span-2" htmlFor={fieldId}>
      <span className="mb-1 block font-semibold text-brand-muted text-xs">{label}</span>
      <StaffTextarea
        aria-describedby={errorId}
        aria-invalid={Boolean(error) || undefined}
        data-field-key={fieldKey}
        id={fieldId}
        onChange={updateTextareaValue}
        rows={4}
        value={value}
      />
      {error ? (
        <p className="mt-1 text-red-700 text-xs" id={errorId}>
          {error}
        </p>
      ) : null}
      {maxWords ? (
        <span
          className={`mt-1 block text-xs ${wordCount >= maxWords ? "text-amber-700" : "text-brand-muted"}`}
        >
          {wordCount}/{maxWords} words
        </span>
      ) : null}
    </label>
  );
}

function LifecycleDates({ items, compact = false }) {
  const visible = (items || []).filter((item) => item.value);
  if (visible.length === 0) {
    return null;
  }
  return (
    <div
      className={
        compact ? "" : "mb-4 rounded-lg border border-brand-border bg-brand-light/50 px-4 py-3"
      }
    >
      <div
        className={`flex flex-wrap gap-x-4 gap-y-1 ${compact ? "text-brand-muted text-xs" : "text-brand-muted text-xs"}`}
      >
        {visible.map((item) => (
          <span key={item.label}>
            <span className="font-semibold text-brand-dark">{item.label}:</span>{" "}
            {formatDate(item.value)}
          </span>
        ))}
      </div>
    </div>
  );
}

function money(value) {
  return `INR ${Number(value || 0).toLocaleString("en-IN")}`;
}

function contractingTotalCost(rowOrForm) {
  return (
    Number(rowOrForm?.contractingLandCost || 0) +
    Number(rowOrForm?.contractingAirlinesCost || 0) +
    Number(rowOrForm?.contractingVisaCost || 0)
  );
}

function proposalCostPerPax(landCostPerPax, airfarePerPax, visaCostPerPax = 0) {
  return (
    Math.max(Number(landCostPerPax) || 0, 0) +
    Math.max(Number(airfarePerPax) || 0, 0) +
    Math.max(Number(visaCostPerPax) || 0, 0)
  );
}

function isQueryConfirmed(rowOrForm) {
  return (
    rowOrForm?.salesStatus === "Order Confirmed" ||
    rowOrForm?.contractingStatus === "Order Confirmed"
  );
}

function ContractingCostFields({ form, updateForm }) {
  const totalCost = contractingTotalCost(form);

  return (
    <>
      <div className="rounded-xl border border-brand-border bg-brand-light/60 p-4 md:col-span-2">
        <div className="mb-3 font-heading font-semibold text-citius-blue text-sm">
          Contracting cost
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Land Cost (INR)"
            onChange={(v) => updateForm("contractingLandCost", v)}
            type="number"
            value={form.contractingLandCost}
          />
          <Input
            label="Airlines Cost (INR)"
            onChange={(v) => updateForm("contractingAirlinesCost", v)}
            type="number"
            value={form.contractingAirlinesCost}
          />
          <Input
            label="Visa Cost (INR)"
            onChange={(v) => updateForm("contractingVisaCost", v)}
            type="number"
            value={form.contractingVisaCost}
          />
          <div className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm">
            <div className="font-semibold text-brand-muted text-xs uppercase tracking-wide">
              Total cost
            </div>
            <div className="mt-1 font-semibold text-brand-dark">{money(totalCost)}</div>
          </div>
        </div>
      </div>
    </>
  );
}

function FinalizedProposalPdfPanel({
  proposalId,
  finalizedPdf,
  canSend,
  generateFinalizedPdfUploadUrl,
  attachFinalizedPdf,
  getFinalizedPdfUrl,
  removeFinalizedPdf,
}) {
  const toast = usePortalToast();
  const { confirm } = usePortalConfirm();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!(file && proposalId)) {
      return;
    }

    if (file.size > MAX_QUERY_ATTACHMENT_BYTES) {
      setUploadError(`${file.name} exceeds the 15 MB limit.`);
      return;
    }

    setIsUploading(true);
    setUploadError("");
    let nextUploadError = "";
    try {
      const uploadUrl = await generateFinalizedPdfUploadUrl({ proposalId });
      const uploadRes = await fetch(uploadUrl, {
        body: file,
        headers: { "Content-Type": file.type || "application/pdf" },
        method: "POST",
      });
      if (uploadRes.ok) {
        const { storageId } = await uploadRes.json();
        await attachFinalizedPdf({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "application/pdf",
          proposalId,
          storageId,
        });
      } else {
        nextUploadError = `Failed to upload ${file.name}.`;
      }
    } catch (err) {
      nextUploadError = err?.data || err?.message || "Upload failed.";
    }
    setUploadError(nextUploadError);
    setIsUploading(false);
  };

  const handleRemove = async () => {
    await confirm({
      confirmLabel: "Remove",
      danger: true,
      message: "Remove the proposal document?",
      onConfirm: async () => {
        await removeFinalizedPdf({ proposalId });
        toast.success("Proposal document removed.");
      },
      title: "Remove proposal document",
    });
  };

  return (
    <m.div className="space-y-4">
      <p className="text-brand-muted text-sm">
        Upload the proposal document here. Sales can download it from Queries or Proposals.
      </p>
      {canSend && (
        <div className="rounded-xl border border-brand-border bg-brand-light/40 p-4">
          <label
            className="mb-2 block font-medium text-brand-text text-sm"
            htmlFor="finalized-proposal-pdf-upload"
          >
            {finalizedPdf ? "Replace Proposal Document" : "Upload Proposal Document"}
          </label>
          <p className="mb-3 text-brand-muted text-xs">PDF only, up to 15 MB.</p>
          <input
            accept=".pdf,application/pdf"
            className="block w-full text-brand-text text-sm file:mr-3 file:rounded-full file:border-0 file:bg-citius-orange file:px-4 file:py-2 file:font-semibold file:text-brand-dark file:text-sm"
            disabled={isUploading}
            id="finalized-proposal-pdf-upload"
            onChange={handleUpload}
            type="file"
          />
          {isUploading && (
            <p className="mt-2 flex items-center gap-2 text-brand-muted text-sm">
              <Loader2 className="animate-spin" size={14} />
              Uploading…
            </p>
          )}
          {uploadError && <p className="mt-2 text-red-600 text-sm">{uploadError}</p>}
        </div>
      )}

      {finalizedPdf ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-border bg-white px-4 py-3">
          <div className="min-w-0">
            <div className="truncate font-medium text-brand-text">{finalizedPdf.fileName}</div>
            {finalizedPdf.uploadedAt && (
              <div className="text-brand-muted text-xs">
                Uploaded {formatDate(finalizedPdf.uploadedAt)}
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              className="portal-small-btn"
              onClick={() =>
                openFinalizedProposalPdf(proposalId, getFinalizedPdfUrl).catch((err) => {
                  toast.error(err?.data || err?.message || "Unable to open file.");
                })
              }
              type="button"
            >
              Download
            </Button>
            {canSend && (
              <Button className="portal-danger-btn" onClick={handleRemove} type="button">
                Remove
              </Button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-brand-muted text-sm">No proposal document uploaded yet.</p>
      )}
    </m.div>
  );
}

function QueryFilePicker({ files, onChange, inputId }) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-light/40 p-4">
      <label className="mb-2 block font-medium text-brand-text text-sm" htmlFor={inputId}>
        Attachments
      </label>
      <p className="mb-3 text-brand-muted text-xs">
        PDF, Office documents, images, or text files up to 15 MB each.
      </p>
      <input
        accept={QUERY_ATTACHMENT_ACCEPT}
        className="block w-full text-brand-text text-sm file:mr-3 file:rounded-full file:border-0 file:bg-citius-blue file:px-4 file:py-2 file:font-semibold file:text-sm file:text-white hover:file:bg-citius-blue/90"
        id={inputId}
        multiple
        onChange={(event) => {
          const picked = Array.from(event.target.files || []);
          if (!picked.length) {
            return;
          }
          onChange([...files, ...picked]);
          event.target.value = "";
        }}
        type="file"
      />
      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((file) => (
            <li
              className="flex items-center justify-between gap-3 rounded-lg border border-brand-border bg-white px-3 py-2 text-sm"
              key={`${file.name}-${file.size}-${file.lastModified}`}
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-brand-text">{file.name}</div>
                <div className="text-brand-muted text-xs">{formatFileSize(file.size)}</div>
              </div>
              <Button
                className="shrink-0 font-semibold text-red-600 text-xs hover:underline"
                onClick={() =>
                  onChange(
                    files.filter(
                      (entry) =>
                        !(
                          entry.name === file.name &&
                          entry.size === file.size &&
                          entry.lastModified === file.lastModified
                        )
                    )
                  )
                }
                type="button"
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QueryAttachmentsPanel({
  queryId,
  entityId,
  idField = "queryId",
  attachments,
  canManage,
  uploadLabel = "Upload Reference Itinerary",
  generateQueryUploadUrl,
  attachQueryFile,
  getQueryAttachmentUrl,
  isLoadingMore = false,
  attachmentKind = "query",
  onLoadMore,
  removeQueryAttachment,
  showLoadMore = false,
}) {
  const toast = usePortalToast();
  const { confirm } = usePortalConfirm();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleUpload = async (event) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = "";
    const targetId = entityId || queryId;
    if (!(picked.length && targetId)) {
      return;
    }

    setIsUploading(true);
    setUploadError("");
    try {
      await uploadEntityFiles({
        attachFile: attachQueryFile,
        entityId: targetId,
        files: picked,
        generateUploadUrl: generateQueryUploadUrl,
        idField,
      });
    } catch (err) {
      setUploadError(err?.data || err?.message || "Upload failed.");
    }
    setIsUploading(false);
  };

  const handleRemove = async (attachment) => {
    await confirm({
      confirmLabel: "Remove",
      danger: true,
      message: `Remove ${attachment.fileName}?`,
      onConfirm: async () => {
        await removeQueryAttachment({ attachmentId: attachment.id });
        toast.success("File removed.");
      },
      title: "Remove file",
    });
  };

  return (
    <m.div className="space-y-4">
      {canManage && (
        <div className="rounded-xl border border-brand-border bg-brand-light/40 p-4">
          <label
            className="mb-2 block font-medium text-brand-text text-sm"
            htmlFor="query-attachment-upload"
          >
            {uploadLabel}
          </label>
          <input
            accept={QUERY_ATTACHMENT_ACCEPT}
            className="block w-full text-brand-text text-sm file:mr-3 file:rounded-full file:border-0 file:bg-citius-orange file:px-4 file:py-2 file:font-semibold file:text-brand-dark file:text-sm"
            disabled={isUploading}
            id="query-attachment-upload"
            multiple
            onChange={handleUpload}
            type="file"
          />
          {isUploading && (
            <p className="mt-2 flex items-center gap-2 text-brand-muted text-sm">
              <Loader2 className="animate-spin" size={14} />
              Uploading…
            </p>
          )}
          {uploadError && <p className="mt-2 text-red-600 text-sm">{uploadError}</p>}
        </div>
      )}

      {attachments.length === 0 ? (
        <p className="text-brand-muted text-sm">No files attached yet.</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((file) => (
            <li
              className="flex items-center justify-between gap-3 rounded-xl border border-brand-border bg-white px-4 py-3"
              key={file.id}
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-brand-text">{file.fileName}</div>
                <div className="text-brand-muted text-xs">
                  {formatFileSize(file.fileSize)} · {formatDate(file.createdAt)}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  className="portal-small-btn"
                  onClick={() =>
                    openQueryAttachment(file.id, getQueryAttachmentUrl, attachmentKind).catch(
                      (err) => {
                        toast.error(err?.data || err?.message || "Unable to open file.");
                      }
                    )
                  }
                  type="button"
                >
                  Open
                </Button>
                {canManage && (
                  <Button
                    className="portal-small-btn text-red-600"
                    onClick={() => handleRemove(file)}
                    type="button"
                  >
                    Remove
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {showLoadMore ? (
        <Button
          className="portal-small-btn"
          disabled={isLoadingMore}
          onClick={onLoadMore}
          type="button"
        >
          {isLoadingMore ? "Loading…" : "Load more files"}
        </Button>
      ) : null}
    </m.div>
  );
}

export {
  ContractingCostFields,
  FinalizedProposalPdfPanel,
  formatDate,
  formatFileSize,
  formatNotesPreview,
  Input,
  isQueryConfirmed,
  LifecycleDates,
  MAX_QUERY_NOTES_WORDS,
  MultiSelect,
  money,
  notesPreview,
  proposalCostPerPax,
  QueryAttachmentsPanel,
  QueryFilePicker,
  Select,
  Textarea,
};
