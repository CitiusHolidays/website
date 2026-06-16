"use client";

import {
  ContractingCostFields,
  FinalizedProposalPdfPanel,
  Input,
  isQueryConfirmed,
  MAX_QUERY_NOTES_WORDS,
  MultiSelect,
  money,
  proposalCostPerPax,
  QueryAttachmentsPanel,
  QueryFilePicker,
  Select,
  Textarea,
} from "@/components/portal/PortalModalForm";
import {
  CONTRACTING_STATUS_SELECT_OPTIONS,
  FOOD_PREFERENCES,
  GUEST_TYPES,
  LOST_REASONS,
  PAYMENT_TYPES,
  QUERY_SOURCES,
  ROOM_TYPES,
  SALES_DECISION_OPTIONS,
  TRAVEL_TYPES,
} from "@/lib/portal/constants";
import { jobCardSelectOptions } from "@/lib/portal/entityModalLinks";
import {
  canAssignContracting,
  canAssignQueryTicketing,
  canAssignTicketing,
  getQueryTypeOptions,
} from "@/lib/portal/permissions";

export function EntityModalTravellerFields({
  modal,
  form,
  updateForm,
  patchForm,
  has,
  access,
  queries,
  proposals,
  jobCards,
  team,
  contractingTeamOptions,
  operationsTeamOptions,
  ticketingTeamOptions,
  pendingQueryFiles,
  setPendingQueryFiles,
  pendingProposalFiles,
  setPendingProposalFiles,
  generateQueryUploadUrl,
  attachQueryFile,
  getQueryAttachmentUrl,
  removeQueryAttachment,
  generateProposalUploadUrl,
  attachProposalFile,
  getProposalAttachmentUrl,
  removeProposalAttachment,
  generateFinalizedPdfUploadUrl,
  attachFinalizedPdf,
  getFinalizedPdfUrl,
  removeFinalizedPdf,
  handleProposalQuerySelect,
  handleJobQuerySelect,
  handleJobCardSelect,
  handleTravellerSelect,
}) {
  return (
    <>
      {modal === "traveller" && (
        <>
          <Select
            label="Job Card"
            value={form.jobCardId}
            options={jobCardSelectOptions(jobCards, { required: true })}
            onChange={handleJobCardSelect}
            required
          />
          <Input
            label="Full Name"
            value={form.fullName}
            onChange={(v) => updateForm("fullName", v)}
            required
          />
          <Input label="Surname" value={form.surname} onChange={(v) => updateForm("surname", v)} />
          <Input
            label="Given Name"
            value={form.givenName}
            onChange={(v) => updateForm("givenName", v)}
          />
          <Input
            label="Travel Hub"
            value={form.travelHub}
            onChange={(v) => updateForm("travelHub", v)}
          />
          <Input
            label="Travel Date"
            type="date"
            value={form.travelDate}
            onChange={(v) => updateForm("travelDate", v)}
          />
          <Input
            label="Guests travelling with"
            value={form.guestCompanions}
            onChange={(v) => updateForm("guestCompanions", v)}
            placeholder="Spouse, children, friends…"
          />
          <Select
            label="Food Preference"
            value={form.foodPreference}
            options={FOOD_PREFERENCES}
            onChange={(v) => updateForm("foodPreference", v)}
          />
          <Select
            label="Guest Type"
            value={form.guestType}
            options={GUEST_TYPES}
            onChange={(v) => updateForm("guestType", v)}
          />
          <Select
            label="Payment Type"
            value={form.paymentType}
            options={PAYMENT_TYPES}
            onChange={(v) => updateForm("paymentType", v)}
          />
          <Select
            label="Room Type"
            value={form.roomType}
            options={ROOM_TYPES}
            onChange={(v) => updateForm("roomType", v)}
          />
          <Select
            label="Visa Required"
            value={form.visaRequired}
            options={["Yes", "No"]}
            onChange={(v) => updateForm("visaRequired", v)}
          />
          <Select
            label="Domestic Travel Required"
            value={form.domesticTravelRequired}
            options={["Yes", "No"]}
            onChange={(v) => updateForm("domesticTravelRequired", v)}
          />
          <Input
            label="Biometric Date"
            type="date"
            value={form.biometricAppointmentDate}
            onChange={(v) => updateForm("biometricAppointmentDate", v)}
          />
          <Select
            label="Extension of Tour"
            value={form.extensionOfTour}
            options={["No", "Yes"]}
            onChange={(v) => updateForm("extensionOfTour", v)}
          />
          <Select
            label="Arriving Early"
            value={form.arrivingEarly}
            options={["No", "Yes"]}
            onChange={(v) => updateForm("arrivingEarly", v)}
          />
          <Input
            label="Passport Status"
            value={form.passportStatus}
            onChange={(v) => updateForm("passportStatus", v)}
          />
          <Input
            label="Hotel Allocation"
            value={form.hotelAllocation}
            onChange={(v) => updateForm("hotelAllocation", v)}
          />
          <Textarea
            label="Special Requests"
            value={form.notes}
            onChange={(v) => updateForm("notes", v)}
          />
        </>
      )}
    </>
  );
}
