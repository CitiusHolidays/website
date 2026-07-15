"use client";

import { Loader2 } from "lucide-react";
import { usePortalConfirm } from "@/components/portal/PortalConfirmDialog";
import { usePortalToast } from "@/components/portal/PortalToast";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { usePatchReducer } from "@/lib/portal/patchReducer";
import { runMutation } from "@/lib/portal/runMutation";
import { inferPassportMimeType, travelBatchDisplayLabel } from "../portalOperationsHelpers";
import type { PassportDocumentsViewProps } from "../portalViewTypes";
import { formatConvexError, openPortalFile, strong } from "../portalWorkspaceListHelpers";
import { Badge, DeleteButton } from "../portalWorkspaceListUi";
import { PassportUploadModal } from "./PassportUploadModal";

type PassportRow = PassportDocumentsViewProps["travellers"][number];

export function PassportDocumentsView({
  travellers,
  has,
  generateUploadUrl,
  encryptAndStorePassport,
  getPassportDocument,
  removePassport,
  deleteItem,
  deleteSelected,
  removeTraveller,
  removeManyTravellers,
  filtersActive = false,
}: PassportDocumentsViewProps) {
  const toast = usePortalToast() as {
    error: (message: string) => void;
    success: (message: string) => void;
  };
  const { confirm } = usePortalConfirm() as {
    confirm: (options: {
      confirmLabel?: string;
      danger?: boolean;
      message: string;
      onConfirm?: () => Promise<unknown>;
      title: string;
    }) => Promise<boolean>;
  };
  const [passportState, patchPassportState] = usePatchReducer({
    isUploading: false,
    passportForm: {
      dateOfBirth: "",
      expiryDate: "",
      nationality: "",
      number: "",
    },
    uploadError: "",
    uploadTraveller: null,
    viewingTravellerId: null,
  });
  const { uploadTraveller, isUploading, uploadError, passportForm, viewingTravellerId } =
    passportState;
  const setUploadTraveller = (value: PassportDocumentsViewProps["travellers"][number] | null) =>
    patchPassportState({ uploadTraveller: value });
  const setIsUploading = (value: boolean) => patchPassportState({ isUploading: value });
  const setUploadError = (value: string) => patchPassportState({ uploadError: value });
  const setPassportForm = (
    value: typeof passportForm | ((current: typeof passportForm) => typeof passportForm)
  ) =>
    patchPassportState({
      passportForm: typeof value === "function" ? value(passportForm) : value,
    });
  const setViewingTravellerId = (value: string | null) =>
    patchPassportState({ viewingTravellerId: value });

  const MAX_PASSPORT_FILE_BYTES = 15 * 1024 * 1024;

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!uploadTraveller) {
      return;
    }
    const fileInput = document.getElementById("passport-file-input") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (!file) {
      setUploadError("Please select a passport scan file.");
      return;
    }
    if (file.size > MAX_PASSPORT_FILE_BYTES) {
      setUploadError("Passport scans must be 15 MB or smaller.");
      return;
    }
    const mimeType = inferPassportMimeType(file);
    if (!mimeType) {
      setUploadError("Passport scans must be PDF, JPEG, PNG, or WebP files.");
      return;
    }

    setIsUploading(true);
    setUploadError("");
    try {
      const uploadUrl = await generateUploadUrl({ travellerId: String(uploadTraveller.id) });
      const uploadRes = await fetch(uploadUrl, {
        body: file,
        headers: { "Content-Type": mimeType },
        method: "POST",
      });
      if (!uploadRes.ok) {
        setUploadError("Failed to upload file to storage server.");
        setIsUploading(false);
        return;
      }
      const { storageId } = await uploadRes.json();

      await encryptAndStorePassport({
        dateOfBirth: passportForm.dateOfBirth || undefined,
        expiryDate: passportForm.expiryDate || undefined,
        fileName: file.name,
        fileSize: file.size,
        mimeType,
        nationality: passportForm.nationality || undefined,
        number: passportForm.number || undefined,
        tempStorageId: storageId,
        travellerId: String(uploadTraveller.id),
      });

      setUploadTraveller(null);
      setPassportForm({ dateOfBirth: "", expiryDate: "", nationality: "", number: "" });
      toast.success("Passport scan uploaded and encrypted successfully.");
    } catch (err) {
      console.error(err);
      setUploadError(formatConvexError(err, "Failed to upload passport. Please try again."));
    }
    setIsUploading(false);
  };

  const handleView = (travellerId: string) => {
    setViewingTravellerId(travellerId);
    try {
      void getPassportDocument;
      openPortalFile(`/api/portal/files/passport/${encodeURIComponent(travellerId)}`);
    } catch (err) {
      console.error(err);
      toast.error(formatConvexError(err, "Unable to open passport scan."));
    }
    setViewingTravellerId(null);
  };

  const handleDeletePassport = async (travellerName: string, travellerId: string) => {
    await confirm({
      confirmLabel: "Delete",
      danger: true,
      message: `Delete passport scan for ${travellerName}? This cannot be undone.`,
      onConfirm: () =>
        runMutation({ showToast: toast, successMessage: "Passport scan deleted." }, () =>
          removePassport({ travellerId })
        ),
      title: "Delete passport scan",
    });
  };

  return (
    <div className="space-y-6">
      <SelectableDataTable
        columns={[
          {
            id: "traveller",
            label: "Traveller",
            render: (row: PassportRow) => strong(row.fullName),
          },
          { id: "job-code", label: "Job Code", render: (row: PassportRow) => row.jobCode },
          {
            id: "travel-batch",
            label: "Travel Batch",
            render: (row: PassportRow) => travelBatchDisplayLabel(row),
          },
          { id: "client", label: "Client", render: (row: PassportRow) => row.clientName },
          {
            id: "passport-scan-status",
            label: "Passport Scan Status",
            render: (row: PassportRow) => (
              <Badge
                label={String(row.passportStatus || "Pending")}
                tone={row.passportStatus === "Received" ? "green" : "orange"}
              />
            ),
          },
          {
            id: "action",
            kind: "action",
            label: "Action",
            render: (row: PassportRow) => (
              <div className="flex flex-wrap gap-2">
                {row.hasPassportScan ? (
                  <>
                    <button
                      className="portal-small-btn inline-flex items-center gap-1 bg-citius-blue text-white hover:bg-citius-blue/90"
                      disabled={viewingTravellerId !== null}
                      onClick={() => handleView(String(row.id))}
                      type="button"
                    >
                      {viewingTravellerId === row.id ? (
                        <>
                          <Loader2 className="size-3 animate-spin" />
                          Decrypting…
                        </>
                      ) : (
                        "Decrypt & View"
                      )}
                    </button>
                    {has(P.MANAGE_VISA) && (
                      <button
                        className="portal-small-btn border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => handleDeletePassport(String(row.fullName), String(row.id))}
                        type="button"
                      >
                        Delete Document
                      </button>
                    )}
                  </>
                ) : (
                  has(P.MANAGE_VISA) && (
                    <button
                      className="portal-small-btn border-brand-border bg-brand-light text-brand-dark hover:bg-brand-light/70"
                      onClick={() =>
                        setUploadTraveller(row as PassportDocumentsViewProps["travellers"][number])
                      }
                      type="button"
                    >
                      {row.passportStatus === "Received" ? "Upload Scan" : "Upload Passport Scan"}
                    </button>
                  )
                )}
                {has(P.MANAGE_TRAVELLERS) && (
                  <DeleteButton
                    label={String(row.fullName)}
                    onClick={() =>
                      deleteItem(String(row.fullName), removeTraveller, {
                        travellerId: String(row.id),
                      })
                    }
                  />
                )}
              </div>
            ),
          },
        ]}
        empty="No travellers on record."
        entityLabel="traveller"
        filtersActive={filtersActive}
        mobileCardRender={(row: PassportRow) => (
          <div className="space-y-1">
            <div className="font-semibold text-brand-dark">{row.fullName}</div>
            <div className="text-brand-muted text-xs">
              {row.jobCode} · {row.clientName || "No client"} · {travelBatchDisplayLabel(row)}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge
                label={String(row.passportStatus || "Pending")}
                tone={row.passportStatus === "Received" ? "green" : "orange"}
              />
              {row.hasPassportScan ? <Badge label="Scan uploaded" tone="green" /> : null}
            </div>
          </div>
        )}
        onBulkDelete={
          has(P.MANAGE_TRAVELLERS)
            ? async (ids: string[]) => {
                await deleteSelected(ids.length, "traveller", removeManyTravellers, () => ({
                  travellerIds: ids,
                }));
                return true;
              }
            : undefined
        }
        rowLabel={(row: PassportRow) => String(row.fullName)}
        rows={travellers}
        selectable={has(P.MANAGE_TRAVELLERS)}
      />

      <PassportUploadModal
        isUploading={isUploading}
        onClose={() => setUploadTraveller(null)}
        onSubmit={handleUpload}
        passportForm={passportForm}
        setPassportForm={setPassportForm}
        uploadError={uploadError}
        uploadTraveller={uploadTraveller}
      />
    </div>
  );
}
