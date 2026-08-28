// biome-ignore-all lint/performance/noJsxPropsBind: editor handlers intentionally close over the selected files and upload draft.

"use client";

import { useAction } from "convex/react";
import { anyApi } from "convex/server";
import { Upload } from "lucide-react";
import { useState } from "react";
import { formatFileSize } from "@/components/portal/PortalModalForm";
import { usePortalToast } from "@/components/portal/PortalToast";
import { Button } from "@/components/ui/application-button";
import { Input as StaffInput } from "@/components/ui/application-field";
import { Select } from "@/components/ui/application-select";
import { hasOwnKey, isRuntimeObject, isRuntimeString } from "../../../../lib/runtimeValues";
import type {
  CommercialFileCategory,
  CommercialFileSourceOption,
  CommercialFileTeamArea,
} from "./commercialFilesModalState";

const FILE_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp,.gif";
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MIME_BY_EXTENSION = {
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
} satisfies Record<string, string>;

function mimeTypeForFile(file: File) {
  if (file.type) {
    return file.type;
  }
  const extension = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
  return hasOwnKey(MIME_BY_EXTENSION, extension)
    ? MIME_BY_EXTENSION[extension]
    : "application/octet-stream";
}

function errorMessage(cause: unknown, fallback: string) {
  if (cause && isRuntimeObject(cause)) {
    const data = "data" in cause ? cause.data : undefined;
    const message = "message" in cause ? cause.message : undefined;
    if (isRuntimeString(data)) {
      return data;
    }
    if (isRuntimeString(message)) {
      return message;
    }
  }
  return fallback;
}

async function runCommercialUploads(
  files: File[],
  uploadOne: (file: File) => Promise<void>,
  onSuccess: () => void,
  onSettled: () => void
) {
  try {
    for (const file of files) {
      // biome-ignore lint/performance/noAwaitInLoops: preserve ordered uploads and stop after the first failed file.
      await uploadOne(file);
    }
    onSuccess();
    return "";
  } catch (uploadError) {
    return errorMessage(uploadError, "Upload failed.");
  } finally {
    onSettled();
  }
}

export function CommercialFileUploadEditor({
  proposalDocAllowed,
  selectedSource,
  selectedTeamArea,
}: {
  proposalDocAllowed: boolean;
  selectedSource: CommercialFileSourceOption;
  selectedTeamArea: CommercialFileTeamArea;
}) {
  const toast = usePortalToast();
  const generateUploadUrl = useAction(anyApi.crm.commercialFileActions.generateUploadUrl);
  const uploadFile = useAction(anyApi.crm.commercialFileActions.uploadFile);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [uploadCategory, setUploadCategory] = useState<CommercialFileCategory>("workingFile");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
    if (pendingFiles.length === 0) {
      setError("Choose a file first.");
      return;
    }
    setBusy(true);
    setError("");
    const uploadError = await runCommercialUploads(
      pendingFiles,
      async (file) => {
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
          throw new Error(`Unable to upload ${file.name}. Try again.`);
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
      },
      () => {
        toast.success(
          `${pendingFiles.length} file${pendingFiles.length === 1 ? "" : "s"} uploaded.`
        );
        setPendingFiles([]);
        setNote("");
      },
      () => setBusy(false)
    );
    if (uploadError) {
      setError(uploadError);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 font-semibold text-brand-dark text-sm">
        <Upload size={15} /> Add to a Team File Area
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Select
          aria-label="Upload category"
          className="h-11 rounded-xl border border-brand-border bg-white px-3 text-sm"
          onValueChange={(value) => {
            setPendingFiles([]);
            const category = (["workingFile", "proposalDoc"] as const).find(
              (candidate) => candidate === value
            );
            if (category) {
              setUploadCategory(category);
            }
          }}
          options={[
            { label: "Working File", value: "workingFile" },
            ...(proposalDocAllowed ? [{ label: "Proposal Doc (PDF)", value: "proposalDoc" }] : []),
          ]}
          value={uploadCategory}
        />
        <label className="flex h-11 cursor-pointer items-center justify-center rounded-xl border border-citius-blue border-dashed bg-white px-3 font-semibold text-citius-blue text-sm hover:bg-citius-blue/[0.04]">
          <input
            accept={uploadCategory === "proposalDoc" ? ".pdf,application/pdf" : FILE_ACCEPT}
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
            <Button
              className="text-brand-muted text-xs hover:underline"
              onClick={() => setPendingFiles([])}
              type="button"
            >
              Clear
            </Button>
          </div>
          <div className="mt-2 space-y-1 text-brand-muted text-xs">
            {pendingFiles.map((file) => (
              <div className="flex justify-between gap-3" key={`${file.name}-${file.lastModified}`}>
                <span className="truncate">{file.name}</span>
                <span>{formatFileSize(file.size)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <StaffInput
          aria-label="Upload note (optional)"
          className="h-11 rounded-xl border border-brand-border bg-white px-3 text-sm"
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional note or description"
          value={note}
        />
        <Button
          className="portal-primary-btn"
          disabled={busy || pendingFiles.length === 0}
          onClick={handleUpload}
          type="button"
        >
          {busy ? "Uploading…" : "Upload files"}
        </Button>
      </div>
      <p className="mt-2 text-brand-muted text-xs">
        Working Files accept PDF, Office documents, images, and text up to 15 MB each. Proposal Docs
        are PDF-only.
      </p>
      {error ? (
        <div
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm"
          role="alert"
        >
          {error}
        </div>
      ) : null}
    </>
  );
}
