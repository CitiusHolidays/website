"use client";

import { api } from "@convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { FileText, History, Paperclip, RotateCcw, Search, Trash2, Upload, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { usePortalConfirm } from "@/components/portal/PortalConfirmDialog";
import { formatDate, formatFileSize } from "@/components/portal/PortalModalForm";
import { usePortalToast } from "@/components/portal/PortalToast";
import { PORTAL_Z } from "@/lib/portal/zIndex";

const FILE_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp,.gif";
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const EMPTY_FORM = {};
const MIME_BY_EXTENSION: Record<string, string> = {
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
const TEAM_AREA_OPTIONS: Array<{ label: string; value: TeamArea }> = [
  { label: "Sales", value: "sales" },
  { label: "Contracting", value: "contracting" },
  { label: "Ticketing", value: "ticketing" },
  { label: "Accounts", value: "accounts" },
  { label: "Operations", value: "operations" },
  { label: "Tour Manager", value: "tourManager" },
];

type SourceType = "query" | "proposal" | "jobCard";
type Category = "workingFile" | "proposalDoc";
type TeamArea = "sales" | "contracting" | "ticketing" | "accounts" | "operations" | "tourManager";

type FormState = {
  entityId?: string;
  entryPoint?: SourceType;
  proposalId?: string;
  queryId?: string;
  jobCardId?: string;
  [key: string]: unknown;
};

type CommercialFileRow = {
  attachmentId: string;
  canDelete: boolean;
  canEditNote: boolean;
  canRestore: boolean;
  canRestoreHistory: boolean;
  category: Category;
  createdAt: number;
  createdBy: string;
  deletedAt?: number;
  fileKind: "attachment" | "proposalDoc";
  fileName: string;
  fileSize: number;
  id: string;
  lifecycle: "active" | "history" | "deleted";
  mimeType: string;
  note?: string;
  readOnly: boolean;
  sourceCode: string;
  sourceId: string;
  sourceLabel: string;
  sourceType: SourceType;
  teamArea: TeamArea;
  teamLabel: string;
  uploaderTeam: string;
};

type SourceOption = {
  code: string;
  id: string;
  label: string;
  sourceType: SourceType;
  teamAreas: TeamArea[];
};

function sourceIdForForm(form: FormState) {
  return String(form.entityId || form.queryId || form.proposalId || form.jobCardId || "");
}

function sourceTypeForForm(form: FormState): SourceType {
  if (form.entryPoint === "proposal" || form.proposalId) {
    return "proposal";
  }
  if (form.entryPoint === "jobCard" || form.jobCardId) {
    return "jobCard";
  }
  return "query";
}

function mimeTypeForFile(file: File) {
  if (file.type) {
    return file.type;
  }
  const extension = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
  return MIME_BY_EXTENSION[extension] || "application/octet-stream";
}

function formatLifecycle(row: CommercialFileRow) {
  if (row.lifecycle === "deleted") {
    return row.deletedAt ? `Deleted ${formatDate(row.deletedAt)}` : "Recoverable deletion";
  }
  if (row.lifecycle === "history") {
    return "Proposal Doc history";
  }
  return `Uploaded ${formatDate(row.createdAt)}`;
}

function openFile(fileId: string) {
  let url = `/api/portal/files/commercial/${encodeURIComponent(fileId)}`;
  if (fileId.startsWith("legacy-query:")) {
    url = `/api/portal/files/query/${encodeURIComponent(fileId.slice("legacy-query:".length))}`;
  } else if (fileId.startsWith("legacy-proposal:")) {
    url = `/api/portal/files/proposal/${encodeURIComponent(fileId.slice("legacy-proposal:".length))}`;
  } else if (fileId.startsWith("legacy-proposal-doc:")) {
    url = `/api/portal/files/proposal-finalized/${encodeURIComponent(fileId.slice("legacy-proposal-doc:".length))}`;
  }
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    const link = document.createElement("a");
    link.href = url;
    link.rel = "noopener noreferrer";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const candidate = error as { data?: unknown; message?: unknown };
    if (typeof candidate.data === "string") {
      return candidate.data;
    }
    if (typeof candidate.message === "string") {
      return candidate.message;
    }
  }
  return fallback;
}

export function CommercialFilesModal({
  close,
  form = EMPTY_FORM,
  modal,
}: {
  close: () => void;
  form?: FormState;
  modal: string | null;
}) {
  const open = modal === "commercialFiles";
  const toast = usePortalToast() as {
    error: (message: string) => unknown;
    success: (message: string) => unknown;
  };
  const { confirm } = usePortalConfirm() as {
    confirm: (options: {
      confirmLabel: string;
      danger: boolean;
      message: string;
      onConfirm: () => Promise<void>;
      title: string;
    }) => Promise<unknown>;
  };
  const entryPoint = sourceTypeForForm(form);
  const entityId = sourceIdForForm(form);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [teamArea, setTeamArea] = useState<TeamArea | "">("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [rows, setRows] = useState<CommercialFileRow[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [uploadCategory, setUploadCategory] = useState<Category>("workingFile");
  const [selectedSourceKey, setSelectedSourceKey] = useState("");
  const [selectedTeamArea, setSelectedTeamArea] = useState<TeamArea | "">("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rawSourceFilterType, rawSourceFilterId] = sourceFilter.split(":", 2);
  const sourceFilterType: SourceType | undefined =
    rawSourceFilterType === "query" ||
    rawSourceFilterType === "proposal" ||
    rawSourceFilterType === "jobCard"
      ? rawSourceFilterType
      : undefined;
  const sourceFilterId = sourceFilterType ? rawSourceFilterId : undefined;

  const queryArgs =
    open && entityId
      ? {
          category: category || undefined,
          cursor,
          entityId,
          entryPoint,
          includeDeleted: showDeleted,
          includeHistory: true,
          limit: 25,
          search: search.trim() || undefined,
          sourceId: sourceFilterId || undefined,
          sourceType: sourceFilterType,
          teamArea: teamArea || undefined,
        }
      : "skip";
  const result = useQuery(api.crm.commercialFiles.listForEntryPoint, queryArgs);
  const generateUploadUrl = useAction(anyApi.crm.commercialFileActions.generateUploadUrl);
  const uploadFile = useAction(anyApi.crm.commercialFileActions.uploadFile);
  const updateNote = useMutation(api.crm.commercialFiles.updateNote);
  const deleteFile = useMutation(api.crm.commercialFiles.deleteFile);
  const restoreFile = useMutation(api.crm.commercialFiles.restoreFile);
  const restoreProposalHistory = useMutation(api.crm.commercialFiles.restoreProposalHistory);

  const filterSignature = JSON.stringify({
    category,
    entityId,
    entryPoint,
    search,
    showDeleted,
    sourceFilter,
    teamArea,
  });
  useEffect(() => {
    setCursor(undefined);
    setRows([]);
  }, [filterSignature]);

  useEffect(() => {
    if (!result) {
      return;
    }
    setRows((previous) => {
      if (!cursor) {
        return result.items as CommercialFileRow[];
      }
      const merged = new Map(previous.map((row) => [row.id, row]));
      for (const row of result.items as CommercialFileRow[]) {
        merged.set(row.id, row);
      }
      return Array.from(merged.values());
    });
  }, [cursor, result]);

  const sourceOptions = (result?.writableSources || []) as SourceOption[];
  const allSourceOptions = (result?.sourceOptions || []) as SourceOption[];
  const selectedSource = sourceOptions.find(
    (source) => `${source.sourceType}:${source.id}` === selectedSourceKey
  );
  const selectedAreas = selectedSource?.teamAreas || [];

  useEffect(() => {
    if (!open) {
      return;
    }
    setPendingFiles([]);
    setNote("");
    setEditingNoteId(null);
    setEditingNote("");
    setError("");
    setUploadCategory("workingFile");
    setSelectedSourceKey("");
    setSelectedTeamArea("");
  }, [entityId, entryPoint, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (sourceOptions.length === 0) {
      setSelectedSourceKey("");
      setSelectedTeamArea("");
      return;
    }
    const current = sourceOptions.find(
      (source) => source.sourceType === entryPoint && source.id === entityId
    );
    const nextSource =
      sourceOptions.find((source) => `${source.sourceType}:${source.id}` === selectedSourceKey) ||
      current ||
      sourceOptions[0];
    const nextKey = `${nextSource.sourceType}:${nextSource.id}`;
    if (nextKey !== selectedSourceKey) {
      setSelectedSourceKey(nextKey);
    }
    if (!(selectedTeamArea && nextSource.teamAreas.includes(selectedTeamArea))) {
      setSelectedTeamArea(nextSource.teamAreas[0] || "");
    }
    if (nextSource.sourceType !== "proposal" && uploadCategory === "proposalDoc") {
      setUploadCategory("workingFile");
      setPendingFiles([]);
    }
  }, [
    entityId,
    entryPoint,
    open,
    selectedSourceKey,
    selectedTeamArea,
    sourceOptions,
    uploadCategory,
  ]);

  const groupedRows = useMemo(() => {
    const groups = new Map<string, CommercialFileRow[]>();
    for (const row of rows) {
      const key = `${row.teamArea}:${row.sourceType}:${row.sourceId}`;
      groups.set(key, [...(groups.get(key) || []), row]);
    }
    return Array.from(groups.entries()).map(([key, items]) => ({
      items,
      key,
      label: `${items[0].teamLabel} · ${items[0].sourceLabel}`,
    }));
  }, [rows]);

  const handleFilesSelected = (files: File[]) => {
    const invalid = files.find((file) => file.size > MAX_FILE_BYTES);
    if (invalid) {
      setError(`${invalid.name} exceeds the 15 MB limit.`);
      return;
    }
    if (uploadCategory === "proposalDoc") {
      const invalidPdf = files.find(
        (file) =>
          !(
            (file.type || "").toLowerCase().startsWith("application/pdf") ||
            file.name.toLowerCase().endsWith(".pdf")
          )
      );
      if (invalidPdf) {
        setError("Proposal Docs must be PDF files.");
        return;
      }
      setPendingFiles(files.slice(0, 1));
    } else {
      setPendingFiles((previous) => [...previous, ...files]);
    }
    setError("");
  };

  const handleUpload = async () => {
    if (!(pendingFiles.length && selectedSource && selectedTeamArea)) {
      setError("Choose a writable source and Team File Area first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      for (const file of pendingFiles) {
        const { uploadToken, uploadUrl } = await generateUploadUrl({
          category: uploadCategory,
          sourceId: selectedSource.id,
          sourceType: selectedSource.sourceType,
          teamArea: selectedTeamArea,
        });
        const mimeType = mimeTypeForFile(file);
        const response = await fetch(uploadUrl, {
          body: file,
          headers: { "Content-Type": mimeType },
          method: "POST",
        });
        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}.`);
        }
        const { storageId } = await response.json();
        await uploadFile({
          category: uploadCategory,
          fileName: file.name,
          fileSize: file.size,
          mimeType,
          note: note.trim() || undefined,
          sourceId: selectedSource.id,
          sourceType: selectedSource.sourceType,
          storageId,
          teamArea: selectedTeamArea,
          uploadToken,
        });
      }
      toast.success(`${pendingFiles.length} file${pendingFiles.length === 1 ? "" : "s"} uploaded.`);
      setPendingFiles([]);
      setNote("");
    } catch (uploadError) {
      setError(errorMessage(uploadError, "Upload failed."));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (row: CommercialFileRow) => {
    void confirm({
      confirmLabel: "Delete",
      danger: true,
      message: `${row.fileName} will be hidden and recoverable for 14 days.`,
      onConfirm: async () => {
        await deleteFile({ fileId: row.id });
        if (!showDeleted) {
          setRows((previous) => previous.filter((item) => item.id !== row.id));
        }
        toast.success("File moved to Recoverable Deletion.");
      },
      title: "Delete commercial file",
    });
  };

  const handleRestore = async (row: CommercialFileRow) => {
    try {
      if (row.lifecycle === "history") {
        await restoreProposalHistory({ fileId: row.id });
      } else {
        await restoreFile({ fileId: row.id });
      }
      toast.success("File restored.");
    } catch (restoreError) {
      toast.error(errorMessage(restoreError, "Unable to restore file."));
    }
  };

  const beginNoteEdit = (row: CommercialFileRow) => {
    setEditingNoteId(row.id);
    setEditingNote(row.note || "");
  };

  const handleNote = async (row: CommercialFileRow) => {
    try {
      await updateNote({ fileId: row.id, note: editingNote });
      toast.success("File note updated.");
      setEditingNoteId(null);
    } catch (noteError) {
      toast.error(errorMessage(noteError, "Unable to update note."));
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <m.div
          animate={{ opacity: 1 }}
          className={`fixed inset-0 ${PORTAL_Z.entityModal} grid place-items-center bg-slate-950/65 p-4`}
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onClick={close}
        >
          <m.div
            animate={{ opacity: 1, transform: "translateY(0) scale(1)" }}
            aria-labelledby="commercial-files-title"
            aria-modal="true"
            className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-brand-border bg-white shadow-2xl max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none"
            initial={{ opacity: 0, transform: "translateY(18px) scale(0.98)" }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-brand-border border-b px-5 py-4 max-sm:px-4">
              <div>
                <h2
                  className="font-heading font-semibold text-citius-blue text-xl"
                  id="commercial-files-title"
                >
                  Commercial Files
                </h2>
                <p className="mt-1 text-brand-muted text-sm">
                  Shared working files across this Query, Proposal, and Job Card chain.
                </p>
              </div>
              <button
                aria-label="Close Commercial Files"
                className="portal-small-btn"
                onClick={close}
                type="button"
              >
                <X size={15} /> Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5 max-sm:px-4">
              <div className="grid gap-3 rounded-xl border border-brand-border bg-brand-light/40 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]">
                <label className="relative block">
                  <span className="sr-only">Search Commercial Files</span>
                  <Search
                    className="pointer-events-none absolute top-3 left-3 text-brand-muted"
                    size={16}
                  />
                  <input
                    className="h-11 w-full rounded-xl border border-brand-border bg-white pr-3 pl-9 text-sm outline-none focus:border-citius-blue"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search files, notes, teams, or sources"
                    value={search}
                  />
                </label>
                <select
                  className="h-11 rounded-xl border border-brand-border bg-white px-3 text-sm"
                  onChange={(event) => setCategory(event.target.value as Category | "")}
                  value={category}
                >
                  <option value="">All categories</option>
                  <option value="workingFile">Working File</option>
                  <option value="proposalDoc">Proposal Doc</option>
                </select>
                <select
                  className="h-11 rounded-xl border border-brand-border bg-white px-3 text-sm"
                  onChange={(event) => setTeamArea(event.target.value as TeamArea | "")}
                  value={teamArea}
                >
                  <option value="">All teams</option>
                  {TEAM_AREA_OPTIONS.map((area) => (
                    <option key={area.value} value={area.value}>
                      {area.label}
                    </option>
                  ))}
                </select>
                <select
                  className="h-11 rounded-xl border border-brand-border bg-white px-3 text-sm"
                  onChange={(event) => setSourceFilter(event.target.value)}
                  value={sourceFilter}
                >
                  <option value="">All sources</option>
                  {allSourceOptions.map((source) => (
                    <option
                      key={`${source.sourceType}:${source.id}`}
                      value={`${source.sourceType}:${source.id}`}
                    >
                      {source.label}
                    </option>
                  ))}
                </select>
                <label className="flex h-11 items-center gap-2 rounded-xl border border-brand-border bg-white px-3 text-brand-muted text-xs">
                  <input
                    checked={showDeleted}
                    onChange={(event) => setShowDeleted(event.target.checked)}
                    type="checkbox"
                  />
                  Recoverable deletions
                </label>
              </div>

              {sourceOptions.length > 0 ? (
                <div className="mt-4 rounded-xl border border-citius-blue/20 bg-citius-blue/[0.03] p-4">
                  <div className="flex items-center gap-2 font-semibold text-brand-dark text-sm">
                    <Upload size={15} /> Add to a Team File Area
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    <select
                      className="h-11 rounded-xl border border-brand-border bg-white px-3 text-sm"
                      onChange={(event) => {
                        if (event.target.value !== selectedSourceKey) {
                          setPendingFiles([]);
                          setNote("");
                        }
                        setSelectedSourceKey(event.target.value);
                      }}
                      value={selectedSourceKey}
                    >
                      {sourceOptions.map((source) => (
                        <option
                          key={`${source.sourceType}:${source.id}`}
                          value={`${source.sourceType}:${source.id}`}
                        >
                          {source.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-11 rounded-xl border border-brand-border bg-white px-3 text-sm"
                      onChange={(event) => {
                        const nextTeamArea = event.target.value as TeamArea;
                        if (nextTeamArea !== selectedTeamArea) {
                          setPendingFiles([]);
                          setNote("");
                        }
                        setSelectedTeamArea(nextTeamArea);
                      }}
                      value={selectedTeamArea}
                    >
                      {selectedAreas.map((area) => (
                        <option key={area} value={area}>
                          {area
                            .replace(/([A-Z])/g, " $1")
                            .replace(/^./, (letter) => letter.toUpperCase())}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-11 rounded-xl border border-brand-border bg-white px-3 text-sm"
                      onChange={(event) => {
                        const nextCategory = event.target.value as Category;
                        if (nextCategory !== uploadCategory) {
                          setPendingFiles([]);
                        }
                        setUploadCategory(nextCategory);
                      }}
                      value={uploadCategory}
                    >
                      <option value="workingFile">Working File</option>
                      {selectedSource?.sourceType === "proposal" &&
                      selectedAreas.includes("contracting") ? (
                        <option value="proposalDoc">Proposal Doc (PDF)</option>
                      ) : null}
                    </select>
                    <label className="flex h-11 cursor-pointer items-center justify-center rounded-xl border border-citius-blue border-dashed bg-white px-3 font-semibold text-citius-blue text-sm hover:bg-citius-blue/[0.04]">
                      <input
                        accept={
                          uploadCategory === "proposalDoc" ? ".pdf,application/pdf" : FILE_ACCEPT
                        }
                        className="sr-only"
                        multiple={uploadCategory === "workingFile"}
                        onChange={(event) => {
                          handleFilesSelected(Array.from(event.target.files || []));
                          event.target.value = "";
                        }}
                        type="file"
                      />
                      Choose file{uploadCategory === "workingFile" ? "s" : ""}
                    </label>
                  </div>
                  {pendingFiles.length > 0 ? (
                    <div className="mt-3 rounded-lg border border-brand-border bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="font-medium">
                          {pendingFiles.length} file{pendingFiles.length === 1 ? "" : "s"} ready
                        </span>
                        <button
                          className="text-brand-muted text-xs hover:underline"
                          onClick={() => setPendingFiles([])}
                          type="button"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="mt-2 space-y-1 text-brand-muted text-xs">
                        {pendingFiles.map((file) => (
                          <div
                            className="flex justify-between gap-3"
                            key={`${file.name}-${file.lastModified}`}
                          >
                            <span className="truncate">{file.name}</span>
                            <span>{formatFileSize(file.size)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                    <input
                      className="h-11 rounded-xl border border-brand-border bg-white px-3 text-sm"
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Optional note or description"
                      value={note}
                    />
                    <button
                      className="portal-primary-btn"
                      disabled={busy || pendingFiles.length === 0}
                      onClick={() => void handleUpload()}
                      type="button"
                    >
                      {busy ? "Uploading…" : "Upload files"}
                    </button>
                  </div>
                  <p className="mt-2 text-brand-muted text-xs">
                    Working Files accept PDF, Office documents, images, and text up to 15 MB each.
                    Proposal Docs are PDF-only.
                  </p>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-brand-border bg-brand-light/40 px-4 py-3 text-brand-muted text-sm">
                  You have read-only access to the linked sources. Files can still be downloaded
                  below.
                </div>
              )}

              {error ? (
                <div
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm"
                  role="alert"
                >
                  {error}
                </div>
              ) : null}
              {result ? (
                rows.length === 0 ? (
                  <div className="mt-6 rounded-xl border border-brand-border border-dashed px-4 py-8 text-center text-brand-muted text-sm">
                    No Commercial Files match this view yet.
                  </div>
                ) : (
                  <div className="mt-6 space-y-5">
                    {groupedRows.map((group) => (
                      <section key={group.key}>
                        <h3 className="mb-2 font-heading font-semibold text-brand-dark text-sm">
                          {group.label}
                        </h3>
                        <div className="space-y-2">
                          {group.items.map((row) => (
                            <div
                              className={`rounded-xl border px-4 py-3 ${row.lifecycle === "deleted" ? "border-amber-200 bg-amber-50/40" : row.lifecycle === "history" ? "border-blue-200 bg-blue-50/40" : "border-brand-border bg-white"}`}
                              key={row.id}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex min-w-0 items-start gap-2">
                                  {row.fileKind === "proposalDoc" ? (
                                    <FileText
                                      className="mt-0.5 shrink-0 text-citius-blue"
                                      size={16}
                                    />
                                  ) : (
                                    <Paperclip
                                      className="mt-0.5 shrink-0 text-citius-blue"
                                      size={16}
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <div className="truncate font-medium text-brand-dark">
                                      {row.fileName}
                                    </div>
                                    <div className="mt-1 text-brand-muted text-xs">
                                      {row.category === "proposalDoc"
                                        ? "Proposal Doc"
                                        : "Working File"}{" "}
                                      · {row.teamLabel} · {formatFileSize(row.fileSize)} ·{" "}
                                      {formatLifecycle(row)}
                                    </div>
                                    {editingNoteId === row.id ? (
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        <input
                                          className="h-9 min-w-56 flex-1 rounded-lg border border-brand-border bg-white px-2 text-xs outline-none focus:border-citius-blue"
                                          onChange={(event) => setEditingNote(event.target.value)}
                                          value={editingNote}
                                        />
                                        <button
                                          className="portal-small-btn"
                                          onClick={() => void handleNote(row)}
                                          type="button"
                                        >
                                          Save note
                                        </button>
                                        <button
                                          className="portal-outline-btn"
                                          onClick={() => setEditingNoteId(null)}
                                          type="button"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : row.note ? (
                                      <div className="mt-2 whitespace-pre-wrap text-brand-muted text-xs">
                                        {row.note}
                                      </div>
                                    ) : null}
                                    <div className="mt-1 text-brand-muted text-xs">
                                      Uploaded by {row.uploaderTeam} · {row.createdBy}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                  {row.lifecycle === "deleted" ? null : (
                                    <button
                                      className="portal-small-btn"
                                      onClick={() => openFile(row.id)}
                                      type="button"
                                    >
                                      Open
                                    </button>
                                  )}
                                  {row.canEditNote && editingNoteId !== row.id ? (
                                    <button
                                      aria-label={`Edit note for ${row.fileName}`}
                                      className="portal-small-btn"
                                      onClick={() => beginNoteEdit(row)}
                                      type="button"
                                    >
                                      Note
                                    </button>
                                  ) : null}
                                  {row.canDelete ? (
                                    <button
                                      aria-label={`Delete ${row.fileName}`}
                                      className="portal-danger-btn"
                                      onClick={() => handleDelete(row)}
                                      type="button"
                                    >
                                      <Trash2 size={14} /> Delete
                                    </button>
                                  ) : null}
                                  {row.canRestore || row.canRestoreHistory ? (
                                    <button
                                      className="portal-small-btn"
                                      onClick={() => void handleRestore(row)}
                                      type="button"
                                    >
                                      {row.lifecycle === "history" ? (
                                        <>
                                          <History size={14} /> Restore version
                                        </>
                                      ) : (
                                        <>
                                          <RotateCcw size={14} /> Restore
                                        </>
                                      )}
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )
              ) : (
                <div className="mt-6 text-brand-muted text-sm">Loading Commercial Files…</div>
              )}
              {result?.nextCursor ? (
                <button
                  className="portal-outline-btn mt-5 w-full"
                  disabled={!result}
                  onClick={() => setCursor(result.nextCursor || undefined)}
                  type="button"
                >
                  Load more files
                </button>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 border-brand-border border-t bg-white px-5 py-3 text-brand-muted text-xs max-sm:px-4">
              <span>
                {result?.total ?? 0} file{result?.total === 1 ? "" : "s"} in this view
              </span>
              <button className="portal-outline-btn" onClick={close} type="button">
                Done
              </button>
            </div>
          </m.div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
