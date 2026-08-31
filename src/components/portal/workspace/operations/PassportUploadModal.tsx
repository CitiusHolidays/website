"use client";

import { Loader2 } from "lucide-react";
import type { ChangeEvent } from "react";
import { PortalDateInput } from "@/components/portal/PortalDateInput";
import { ControlledDialog, ControlledDialogTitle } from "@/components/ui/application-dialog";
import { PORTAL_Z } from "@/lib/portal/zIndex";
import type { PortalPassportTravellerRow } from "../portalViewTypes";

export interface PassportUploadModalProps {
  isUploading: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  passportForm: {
    dateOfBirth: string;
    expiryDate: string;
    nationality: string;
    number: string;
  };
  setPassportForm: (
    value:
      | PassportUploadModalProps["passportForm"]
      | ((
          current: PassportUploadModalProps["passportForm"]
        ) => PassportUploadModalProps["passportForm"])
  ) => void;
  uploadError: string;
  uploadTraveller: PortalPassportTravellerRow | null;
}

export function PassportUploadModal({
  uploadTraveller,
  passportForm,
  setPassportForm,
  uploadError,
  isUploading,
  onClose,
  onSubmit,
}: PassportUploadModalProps) {
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose();
    }
  };
  const setPassportNumber = (event: ChangeEvent<HTMLInputElement>) => {
    setPassportForm({ ...passportForm, number: event.target.value });
  };
  const setPassportExpiry = (expiryDate: string) =>
    setPassportForm({ ...passportForm, expiryDate });
  const setPassportNationality = (event: ChangeEvent<HTMLInputElement>) => {
    setPassportForm({ ...passportForm, nationality: event.target.value });
  };
  const setPassportDateOfBirth = (dateOfBirth: string) =>
    setPassportForm({ ...passportForm, dateOfBirth });

  return (
    <ControlledDialog
      backdropClassName="absolute inset-0 bg-slate-950/65"
      closeDisabled={Boolean(uploadTraveller)}
      onOpenChange={handleOpenChange}
      open={Boolean(uploadTraveller)}
      popupClassName="relative w-full max-w-lg space-y-4 rounded-2xl border border-brand-border bg-white p-6 shadow-2xl"
      popupRender={<form onSubmit={onSubmit} />}
      triggerless
      viewportClassName={`fixed inset-0 ${PORTAL_Z.nestedModal} grid place-items-center p-4`}
    >
      {uploadTraveller ? (
        <>
          <div className="flex items-center justify-between border-brand-border border-b pb-3">
            <ControlledDialogTitle className="font-heading font-semibold text-citius-blue text-lg">
              Upload & Encrypt Passport: {uploadTraveller.fullName}
            </ControlledDialogTitle>
            <button
              className="text-brand-muted hover:text-brand-dark"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>

          {uploadError ? (
            <div className="rounded-md border border-red-100 bg-red-50 p-3 text-red-600 text-sm">
              {uploadError}
            </div>
          ) : null}

          <div className="space-y-3">
            <div>
              <label
                className="mb-1 block font-medium text-brand-dark text-xs"
                htmlFor="passport-file-input"
              >
                Passport Scan File (PDF, JPEG, or PNG, max 4 MB) *
              </label>
              <input
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                className="w-full rounded-md border border-brand-border p-2 text-sm focus:outline-none focus:ring-1 focus:ring-citius-blue"
                id="passport-file-input"
                required
                type="file"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  className="mb-1 block font-medium text-brand-dark text-xs"
                  htmlFor="passport-number"
                >
                  Passport Number
                </label>
                <input
                  className="w-full rounded-md border border-brand-border p-2 text-sm focus:outline-none focus:ring-1 focus:ring-citius-blue"
                  id="passport-number"
                  onChange={setPassportNumber}
                  placeholder="e.g. Z1234567"
                  type="text"
                  value={passportForm.number}
                />
              </div>
              <div>
                <label
                  className="mb-1 block font-medium text-brand-dark text-xs"
                  htmlFor="passport-expiry"
                >
                  Expiry Date
                </label>
                <PortalDateInput
                  aria-label="Passport expiry date"
                  className="w-full"
                  id="passport-expiry"
                  inputClassName="!h-9 !rounded-md !text-sm"
                  name="passportExpiryDate"
                  onChange={setPassportExpiry}
                  value={passportForm.expiryDate}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  className="mb-1 block font-medium text-brand-dark text-xs"
                  htmlFor="passport-nationality"
                >
                  Nationality
                </label>
                <input
                  className="w-full rounded-md border border-brand-border p-2 text-sm focus:outline-none focus:ring-1 focus:ring-citius-blue"
                  id="passport-nationality"
                  onChange={setPassportNationality}
                  placeholder="e.g. Indian"
                  type="text"
                  value={passportForm.nationality}
                />
              </div>
              <div>
                <label
                  className="mb-1 block font-medium text-brand-dark text-xs"
                  htmlFor="passport-dob"
                >
                  Date of Birth
                </label>
                <PortalDateInput
                  aria-label="Passport date of birth"
                  className="w-full"
                  id="passport-dob"
                  inputClassName="!h-9 !rounded-md !text-sm"
                  name="passportDateOfBirth"
                  onChange={setPassportDateOfBirth}
                  value={passportForm.dateOfBirth}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-brand-border border-t pt-4">
            <button
              className="portal-small-btn border-brand-border text-brand-dark"
              disabled={isUploading}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="portal-small-btn flex items-center gap-1 bg-citius-blue text-white hover:bg-citius-blue/90"
              disabled={isUploading}
              type="submit"
            >
              {isUploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Encrypting & Saving…
                </>
              ) : (
                "Encrypt & Upload"
              )}
            </button>
          </div>
        </>
      ) : null}
    </ControlledDialog>
  );
}
