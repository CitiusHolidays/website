"use client";

import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { usePortalConfirm } from "@/components/portal/PortalConfirmDialog";
import { usePortalToast } from "@/components/portal/PortalToast";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { Button } from "@/components/ui/application-button";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { usePatchReducer } from "@/lib/portal/patchReducer";
import { runMutation } from "@/lib/portal/runMutation";
import { inferPassportMimeType, travelBatchDisplayLabel } from "../portalOperationsHelpers";
import type { PassportDocumentsViewProps } from "../portalViewTypes";
import { formatConvexError, openPortalFile, strong } from "../portalWorkspaceListHelpers";
import { Badge, DeleteButton } from "../portalWorkspaceListUi";
import { resolveUpdate } from "../workspaceStateTypes";
import { PassportUploadModal } from "./PassportUploadModal";

type PassportRow = PassportDocumentsViewProps["travellers"][number];
const MAX_PASSPORT_FILE_BYTES = 15 * 1024 * 1024;

interface PassportDocumentsState {
  isUploading: boolean;
  passportForm: {
    dateOfBirth: string;
    expiryDate: string;
    nationality: string;
    number: string;
  };
  uploadError: string;
  uploadTraveller: PassportRow | null;
  viewingTravellerId: string | null;
}

function passportRowLabel(row: PassportRow) {
  return String(row.fullName);
}

function PassportMobileCard({ row }: { row: PassportRow }) {
  return (
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
  );
}

function renderPassportMobileCard(row: PassportRow) {
  return <PassportMobileCard row={row} />;
}

function PassportRowActions({
  canManageTravellers,
  canManageVisa,
  deleteItem,
  onDeletePassport,
  onSelectUpload,
  onView,
  removeTraveller,
  row,
  viewingTravellerId,
}: {
  canManageTravellers: boolean;
  canManageVisa: boolean;
  deleteItem: PassportDocumentsViewProps["deleteItem"];
  onDeletePassport: (travellerName: string, travellerId: string) => Promise<void>;
  onSelectUpload: (row: PassportRow) => void;
  onView: (travellerId: string) => Promise<void>;
  removeTraveller: PassportDocumentsViewProps["removeTraveller"];
  row: PassportRow;
  viewingTravellerId: string | null;
}) {
  const travellerId = String(row.id);
  const view = () => onView(travellerId);
  const deletePassport = () => onDeletePassport(String(row.fullName), travellerId);
  const selectUpload = () => onSelectUpload(row);
  const remove = () => {
    deleteItem(String(row.fullName), removeTraveller, { travellerId });
  };
  let passportAction: ReactNode = null;
  if (row.hasPassportScan) {
    passportAction = (
      <>
        <Button
          className="portal-small-btn inline-flex items-center gap-1 bg-citius-blue text-white hover:bg-citius-blue/90"
          disabled={viewingTravellerId !== null}
          onClick={view}
          type="button"
        >
          {viewingTravellerId === travellerId ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Decrypting…
            </>
          ) : (
            "Decrypt & View"
          )}
        </Button>
        {canManageVisa ? (
          <Button
            className="portal-small-btn border-red-200 text-red-600 hover:bg-red-50"
            onClick={deletePassport}
            type="button"
          >
            Delete Document
          </Button>
        ) : null}
      </>
    );
  } else if (canManageVisa) {
    passportAction = (
      <Button
        className="portal-small-btn border-brand-border bg-brand-light text-brand-dark hover:bg-brand-light/70"
        onClick={selectUpload}
        type="button"
      >
        {row.passportStatus === "Received" ? "Upload Scan" : "Upload Passport Scan"}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {passportAction}
      {canManageTravellers ? <DeleteButton label={String(row.fullName)} onClick={remove} /> : null}
    </div>
  );
}

export function PassportDocumentsView({
  travellers,
  has,
  generateUploadUrl,
  encryptAndStorePassport,
  getPassportDocument: _getPassportDocument,
  removePassport,
  deleteItem,
  deleteSelected,
  removeTraveller,
  removeManyTravellers,
  filtersActive = false,
}: PassportDocumentsViewProps) {
  const toast = usePortalToast();
  const { confirm } = usePortalConfirm();
  const initialPassportState: PassportDocumentsState = {
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
  };
  const [passportState, patchPassportState] = usePatchReducer(initialPassportState);
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
      passportForm: resolveUpdate(value, passportForm),
    });
  const setViewingTravellerId = (value: string | null) =>
    patchPassportState({ viewingTravellerId: value });

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!uploadTraveller) {
      return;
    }
    const candidate = document.getElementById("passport-file-input");
    const fileInput = candidate instanceof HTMLInputElement ? candidate : null;
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

  const handleView = async (travellerId: string) => {
    setViewingTravellerId(travellerId);
    try {
      await openPortalFile(`/api/portal/files/passport/${encodeURIComponent(travellerId)}`);
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
  const selectUploadTraveller = (row: PassportRow) => setUploadTraveller(row);
  const closeUpload = () => setUploadTraveller(null);
  const handleBulkDelete = async (ids: string[]) => {
    await deleteSelected(ids.length, "traveller", removeManyTravellers, () => ({
      travellerIds: ids,
    }));
    return true;
  };
  const canManageVisa = has(P.MANAGE_VISA);
  const canManageTravellers = has(P.MANAGE_TRAVELLERS);

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
              <PassportRowActions
                canManageTravellers={canManageTravellers}
                canManageVisa={canManageVisa}
                deleteItem={deleteItem}
                onDeletePassport={handleDeletePassport}
                onSelectUpload={selectUploadTraveller}
                onView={handleView}
                removeTraveller={removeTraveller}
                row={row}
                viewingTravellerId={viewingTravellerId}
              />
            ),
          },
        ]}
        empty="No travellers on record."
        entityLabel="traveller"
        filtersActive={filtersActive}
        mobileCardRender={renderPassportMobileCard}
        onBulkDelete={canManageTravellers ? handleBulkDelete : undefined}
        rowLabel={passportRowLabel}
        rows={travellers}
        selectable={canManageTravellers}
      />

      <PassportUploadModal
        isUploading={isUploading}
        onClose={closeUpload}
        onSubmit={handleUpload}
        passportForm={passportForm}
        setPassportForm={setPassportForm}
        uploadError={uploadError}
        uploadTraveller={uploadTraveller}
      />
    </div>
  );
}
