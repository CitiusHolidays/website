"use client";

import { Loader2 } from "lucide-react";
import { m as motion } from "motion/react";
import { useState } from "react";
import { usePortalConfirm } from "@/components/portal/PortalConfirmDialog";
import { usePortalToast } from "@/components/portal/PortalToast";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_QUERY_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const QUERY_ATTACHMENT_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp,.gif";

async function uploadEntityFiles({ entityId, idField, files, generateUploadUrl, attachFile }) {
  await Promise.all(
    files.map(async (file) => {
      if (file.size > MAX_QUERY_ATTACHMENT_BYTES) {
        throw new Error(`${file.name} exceeds the 15 MB limit.`);
      }
      const uploadUrl = await generateUploadUrl({});
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error(`Failed to upload ${file.name}.`);
      }
      const { storageId } = await uploadRes.json();
      await attachFile({
        [idField]: entityId,
        storageId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
      });
    }),
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
  if (!trimmed) return 0;
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
  if (!text) return "-";
  const words = text.split(/\s+/).filter(Boolean);
  const display = words.length > maxWords ? `${words.slice(0, maxWords).join(" ")}…` : text;
  return (
    <span
      className="block max-w-[220px] whitespace-normal break-words text-xs leading-snug text-brand-muted"
      title={text}
    >
      {display}
    </span>
  );
}

function notesPreview(value) {
  return formatNotesPreview(value);
}

function Input({ label, value, onChange, type = "text", required = false, placeholder, ...rest }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-brand-muted">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-brand-border bg-brand-light px-3 text-sm outline-none transition focus:border-citius-blue focus:bg-white focus:ring-2 focus:ring-citius-blue/10"
        {...rest}
      />
    </label>
  );
}

function Select({ label, value, options, onChange, required = false }) {
  const normalized = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-brand-muted">{label}</span>
      <select
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-brand-border bg-brand-light px-3 text-sm outline-none transition focus:border-citius-blue focus:bg-white focus:ring-2 focus:ring-citius-blue/10"
      >
        {normalized.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MultiSelect({ label, value, options, onChange }) {
  const normalized = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
  const selected = new Set(value);
  return (
    <div className="md:col-span-2">
      <span className="mb-2 block text-xs font-semibold text-brand-muted">{label}</span>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {normalized.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-2 rounded-md border border-brand-border bg-brand-light px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              checked={selected.has(option.value)}
              onChange={(event) => {
                const next = new Set(selected);
                if (event.target.checked) next.add(option.value);
                else next.delete(option.value);
                onChange(Array.from(next));
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function Textarea({ label, value, onChange, maxWords }) {
  const wordCount = countWords(value);
  const updateTextareaValue = (event) => {
    let next = event.target.value;
    if (maxWords) {
      next = truncateToMaxWords(next, maxWords);
    }
    onChange(next);
  };

  return (
    <label className="block md:col-span-2">
      <span className="mb-1 block text-xs font-semibold text-brand-muted">{label}</span>
      <textarea
        value={value}
        onChange={updateTextareaValue}
        rows={4}
        className="w-full rounded-xl border border-brand-border bg-brand-light px-3 py-2 text-sm outline-none transition focus:border-citius-blue focus:bg-white focus:ring-2 focus:ring-citius-blue/10"
      />
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
  if (visible.length === 0) return null;
  return (
    <div
      className={
        compact ? "" : "mb-4 rounded-lg border border-brand-border bg-brand-light/50 px-4 py-3"
      }
    >
      <div
        className={`flex flex-wrap gap-x-4 gap-y-1 ${compact ? "text-xs text-brand-muted" : "text-xs text-brand-muted"}`}
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
      <div className="md:col-span-2 rounded-xl border border-brand-border bg-brand-light/60 p-4">
        <div className="mb-3 font-heading text-sm font-semibold text-citius-blue">
          Contracting cost
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Land Cost (INR)"
            type="number"
            value={form.contractingLandCost}
            onChange={(v) => updateForm("contractingLandCost", v)}
          />
          <Input
            label="Airlines Cost (INR)"
            type="number"
            value={form.contractingAirlinesCost}
            onChange={(v) => updateForm("contractingAirlinesCost", v)}
          />
          <Input
            label="Visa Cost (INR)"
            type="number"
            value={form.contractingVisaCost}
            onChange={(v) => updateForm("contractingVisaCost", v)}
          />
          <div className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
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
    if (!file || !proposalId) return;

    if (file.size > MAX_QUERY_ATTACHMENT_BYTES) {
      setUploadError(`${file.name} exceeds the 15 MB limit.`);
      return;
    }

    setIsUploading(true);
    setUploadError("");
    try {
      const uploadUrl = await generateFinalizedPdfUploadUrl({});
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });
      if (!uploadRes.ok) {
        setUploadError(`Failed to upload ${file.name}.`);
        setIsUploading(false);
        return;
      }
      const { storageId } = await uploadRes.json();
      await attachFinalizedPdf({
        proposalId,
        storageId,
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        fileSize: file.size,
      });
    } catch (err) {
      setUploadError(err?.data || err?.message || "Upload failed.");
    }
    setIsUploading(false);
  };

  const handleRemove = async () => {
    const ok = await confirm({
      title: "Remove finalized PDF",
      message: "Remove the finalized proposal PDF?",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await removeFinalizedPdf({ proposalId });
      toast.success("Finalized PDF removed.");
    } catch (err) {
      toast.error(err?.data || err?.message || "Unable to remove file.");
    }
  };

  return (
    <motion.div className="space-y-4">
      <p className="text-sm text-brand-muted">
        Upload the client-ready proposal PDF here. Sales can download it and send it to the client,
        then mark the proposal as sent.
      </p>
      {canSend && (
        <div className="rounded-xl border border-brand-border bg-brand-light/40 p-4">
          <label
            htmlFor="finalized-proposal-pdf-upload"
            className="mb-2 block text-sm font-medium text-brand-text"
          >
            {finalizedPdf ? "Replace Finalized Proposal PDF" : "Upload Finalized Proposal PDF"}
          </label>
          <p className="mb-3 text-xs text-brand-muted">PDF only, up to 15 MB.</p>
          <input
            id="finalized-proposal-pdf-upload"
            type="file"
            accept=".pdf,application/pdf"
            disabled={isUploading}
            className="block w-full text-sm text-brand-text file:mr-3 file:rounded-full file:border-0 file:bg-citius-orange file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            onChange={handleUpload}
          />
          {isUploading && (
            <p className="mt-2 flex items-center gap-2 text-sm text-brand-muted">
              <Loader2 className="animate-spin" size={14} />
              Uploading…
            </p>
          )}
          {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
        </div>
      )}

      {!finalizedPdf ? (
        <p className="text-sm text-brand-muted">No finalized proposal PDF uploaded yet.</p>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-border bg-white px-4 py-3">
          <div className="min-w-0">
            <div className="truncate font-medium text-brand-text">{finalizedPdf.fileName}</div>
            {finalizedPdf.uploadedAt && (
              <div className="text-xs text-brand-muted">
                Uploaded {formatDate(finalizedPdf.uploadedAt)}
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              className="portal-small-btn"
              onClick={() =>
                openFinalizedProposalPdf(proposalId, getFinalizedPdfUrl).catch((err) => {
                  toast.error(err?.data || err?.message || "Unable to open file.");
                })
              }
            >
              Download
            </button>
            {canSend && (
              <button type="button" className="portal-danger-btn" onClick={handleRemove}>
                Remove
              </button>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function QueryFilePicker({ files, onChange, inputId }) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-light/40 p-4">
      <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-brand-text">
        Attachments
      </label>
      <p className="mb-3 text-xs text-brand-muted">
        PDF, Office documents, images, or text files up to 15 MB each.
      </p>
      <input
        id={inputId}
        type="file"
        multiple
        accept={QUERY_ATTACHMENT_ACCEPT}
        className="block w-full text-sm text-brand-text file:mr-3 file:rounded-full file:border-0 file:bg-citius-blue file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-citius-blue/90"
        onChange={(event) => {
          const picked = Array.from(event.target.files || []);
          if (!picked.length) return;
          onChange([...files, ...picked]);
          event.target.value = "";
        }}
      />
      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-brand-border bg-white px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-brand-text">{file.name}</div>
                <div className="text-xs text-brand-muted">{formatFileSize(file.size)}</div>
              </div>
              <button
                type="button"
                className="shrink-0 text-xs font-semibold text-red-600 hover:underline"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                Remove
              </button>
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
  attachmentKind = "query",
  removeQueryAttachment,
}) {
  const toast = usePortalToast();
  const { confirm } = usePortalConfirm();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleUpload = async (event) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = "";
    const targetId = entityId || queryId;
    if (!picked.length || !targetId) return;

    setIsUploading(true);
    setUploadError("");
    try {
      await uploadEntityFiles({
        entityId: targetId,
        idField,
        files: picked,
        generateUploadUrl: generateQueryUploadUrl,
        attachFile: attachQueryFile,
      });
    } catch (err) {
      setUploadError(err?.data || err?.message || "Upload failed.");
    }
    setIsUploading(false);
  };

  const handleRemove = async (attachment) => {
    const ok = await confirm({
      title: "Remove file",
      message: `Remove ${attachment.fileName}?`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await removeQueryAttachment({ attachmentId: attachment.id });
      toast.success("File removed.");
    } catch (err) {
      toast.error(err?.data || err?.message || "Unable to remove file.");
    }
  };

  return (
    <motion.div className="space-y-4">
      {canManage && (
        <div className="rounded-xl border border-brand-border bg-brand-light/40 p-4">
          <label
            htmlFor="query-attachment-upload"
            className="mb-2 block text-sm font-medium text-brand-text"
          >
            {uploadLabel}
          </label>
          <input
            id="query-attachment-upload"
            type="file"
            multiple
            accept={QUERY_ATTACHMENT_ACCEPT}
            disabled={isUploading}
            className="block w-full text-sm text-brand-text file:mr-3 file:rounded-full file:border-0 file:bg-citius-orange file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            onChange={handleUpload}
          />
          {isUploading && (
            <p className="mt-2 flex items-center gap-2 text-sm text-brand-muted">
              <Loader2 className="animate-spin" size={14} />
              Uploading…
            </p>
          )}
          {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
        </div>
      )}

      {attachments.length === 0 ? (
        <p className="text-sm text-brand-muted">No files attached yet.</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-brand-border bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-brand-text">{file.fileName}</div>
                <div className="text-xs text-brand-muted">
                  {formatFileSize(file.fileSize)} · {formatDate(file.createdAt)}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className="portal-small-btn"
                  onClick={() =>
                    openQueryAttachment(file.id, getQueryAttachmentUrl, attachmentKind).catch(
                      (err) => {
                        toast.error(err?.data || err?.message || "Unable to open file.");
                      },
                    )
                  }
                >
                  Open
                </button>
                {canManage && (
                  <button
                    type="button"
                    className="portal-small-btn text-red-600"
                    onClick={() => handleRemove(file)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
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
