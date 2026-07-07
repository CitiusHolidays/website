"use client";

import { Input, Select, Textarea } from "@/components/portal/PortalModalForm";
import {
  FOOD_PREFERENCES,
  GENDER_OPTIONS,
  GUEST_TYPES,
  PAYMENT_TYPES,
  ROOM_TYPES,
} from "@/lib/portal/constants";
import { jobCardSelectOptions, travelBatchSelectOptions } from "@/lib/portal/entityModalLinks";

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
            onChange={handleJobCardSelect}
            options={jobCardSelectOptions(jobCards, { required: true })}
            required
            value={form.jobCardId}
          />
          <Select
            label="Travel Batch"
            onChange={(value) => updateForm("travelBatchId", value)}
            options={travelBatchSelectOptions(jobCards, form.jobCardId)}
            value={form.travelBatchId || ""}
          />
          <Input
            label="Full Name"
            onChange={(v) => updateForm("fullName", v)}
            required
            value={form.fullName}
          />
          <Input label="Surname" onChange={(v) => updateForm("surname", v)} value={form.surname} />
          <Input
            label="Given Name"
            onChange={(v) => updateForm("givenName", v)}
            value={form.givenName}
          />
          <Select
            label="Gender"
            onChange={(v) => updateForm("gender", v)}
            options={[{ label: "Select gender…", value: "" }, ...GENDER_OPTIONS]}
            value={form.gender}
          />
          <Input
            label="Travel Hub"
            onChange={(v) => updateForm("travelHub", v)}
            value={form.travelHub}
          />
          <Input
            label="Travel Date"
            onChange={(v) => updateForm("travelDate", v)}
            type="date"
            value={form.travelDate}
          />
          <Input
            label="Guests travelling with"
            onChange={(v) => updateForm("guestCompanions", v)}
            placeholder="Spouse, children, friends…"
            value={form.guestCompanions}
          />
          <Select
            label="Food Preference"
            onChange={(v) => updateForm("foodPreference", v)}
            options={FOOD_PREFERENCES}
            value={form.foodPreference}
          />
          <Select
            label="Guest Type"
            onChange={(v) => updateForm("guestType", v)}
            options={GUEST_TYPES}
            value={form.guestType}
          />
          <Select
            label="Payment Type"
            onChange={(v) => updateForm("paymentType", v)}
            options={PAYMENT_TYPES}
            value={form.paymentType}
          />
          <Select
            label="Room Type"
            onChange={(v) => updateForm("roomType", v)}
            options={ROOM_TYPES}
            value={form.roomType}
          />
          <Select
            label="Visa Required"
            onChange={(v) => updateForm("visaRequired", v)}
            options={["Yes", "No"]}
            value={form.visaRequired}
          />
          <Select
            label="Domestic Travel Required"
            onChange={(v) => updateForm("domesticTravelRequired", v)}
            options={["Yes", "No"]}
            value={form.domesticTravelRequired}
          />
          <Input
            label="Biometric Date"
            onChange={(v) => updateForm("biometricAppointmentDate", v)}
            type="date"
            value={form.biometricAppointmentDate}
          />
          <Select
            label="Extension of Tour"
            onChange={(v) => updateForm("extensionOfTour", v)}
            options={["No", "Yes"]}
            value={form.extensionOfTour}
          />
          <Select
            label="Arriving Early"
            onChange={(v) => updateForm("arrivingEarly", v)}
            options={["No", "Yes"]}
            value={form.arrivingEarly}
          />
          <Input
            label="Passport Status"
            onChange={(v) => updateForm("passportStatus", v)}
            value={form.passportStatus}
          />
          <Input
            label="Hotel Allocation"
            onChange={(v) => updateForm("hotelAllocation", v)}
            value={form.hotelAllocation}
          />
          <Textarea
            label="Special Requests"
            onChange={(v) => updateForm("notes", v)}
            value={form.notes}
          />
        </>
      )}
    </>
  );
}
