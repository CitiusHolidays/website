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

  jobCards,

  handleJobCardSelect,
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
            formField="travelBatchId"
            label="Travel in Series"
            onChange={updateForm}
            options={travelBatchSelectOptions(jobCards, form.jobCardId)}
            value={form.travelBatchId || ""}
          />
          <Input
            formField="fullName"
            label="Full Name"
            onChange={updateForm}
            required
            value={form.fullName}
          />
          <Input formField="surname" label="Surname" onChange={updateForm} value={form.surname} />
          <Input
            formField="givenName"
            label="Given Name"
            onChange={updateForm}
            value={form.givenName}
          />
          <Select
            formField="gender"
            label="Gender"
            onChange={updateForm}
            options={[{ label: "Select gender…", value: "" }, ...GENDER_OPTIONS]}
            value={form.gender}
          />
          <fieldset className="col-span-full grid gap-4 rounded-[20px] border border-[#0B1026]/10 bg-[#FDFBF7] p-5 sm:grid-cols-2">
            <legend className="px-1 font-heading text-base text-brand-dark">Guest contact</legend>
            <Input
              autoComplete="tel"
              formField="contactNo"
              label="Guest cell number"
              onChange={updateForm}
              placeholder="Include country code"
              type="tel"
              value={form.contactNo || ""}
            />
            <Input
              autoComplete="email"
              formField="email"
              label="Guest email"
              onChange={updateForm}
              type="email"
              value={form.email || ""}
            />
            <Select
              formField="marketingConsent"
              label="Promotional email permission"
              onChange={updateForm}
              options={[
                { label: "Not recorded", value: "not_recorded" },
                { label: "Guest explicitly opted in", value: "granted" },
                { label: "Guest withdrew permission", value: "withdrawn" },
              ]}
              value={form.marketingConsent || "not_recorded"}
            />
            <Textarea
              formField="marketingConsentNote"
              label="Consent evidence or withdrawal note"
              onChange={updateForm}
              placeholder="Record how and when the guest gave permission. Required for opt-in."
              value={form.marketingConsentNote || ""}
            />
            <p className="col-span-full font-sans text-brand-muted text-xs">
              Use these details for thank-you drafts. Promotional emails need separate permission.
              Saving a contact sends no email.
            </p>
          </fieldset>
          <Input
            formField="travelHub"
            label="Travel Hub"
            onChange={updateForm}
            value={form.travelHub}
          />
          <Input
            formField="travelDate"
            label="Travel Date"
            onChange={updateForm}
            type="date"
            value={form.travelDate}
          />
          <Input
            formField="guestCompanions"
            label="Guests travelling with"
            onChange={updateForm}
            placeholder="Spouse, children, friends…"
            value={form.guestCompanions}
          />
          <Select
            formField="foodPreference"
            label="Food Preference"
            onChange={updateForm}
            options={FOOD_PREFERENCES}
            value={form.foodPreference}
          />
          <Select
            formField="guestType"
            label="Guest Type"
            onChange={updateForm}
            options={GUEST_TYPES}
            value={form.guestType}
          />
          <Select
            formField="paymentType"
            label="Payment Type"
            onChange={updateForm}
            options={PAYMENT_TYPES}
            value={form.paymentType}
          />
          <Select
            formField="roomType"
            label="Room Type"
            onChange={updateForm}
            options={ROOM_TYPES}
            value={form.roomType}
          />
          <Select
            formField="visaRequired"
            label="Visa Required"
            onChange={updateForm}
            options={["Yes", "No"]}
            value={form.visaRequired}
          />
          <Select
            formField="domesticTravelRequired"
            label="Domestic Travel Required"
            onChange={updateForm}
            options={["Yes", "No"]}
            value={form.domesticTravelRequired}
          />
          <Input
            formField="biometricAppointmentDate"
            label="Biometric Date"
            onChange={updateForm}
            type="date"
            value={form.biometricAppointmentDate}
          />
          <Select
            formField="extensionOfTour"
            label="Extension of Tour"
            onChange={updateForm}
            options={["No", "Yes"]}
            value={form.extensionOfTour}
          />
          <Select
            formField="arrivingEarly"
            label="Arriving Early"
            onChange={updateForm}
            options={["No", "Yes"]}
            value={form.arrivingEarly}
          />
          <Input
            formField="passportStatus"
            label="Passport Status"
            onChange={updateForm}
            value={form.passportStatus}
          />
          <Input
            formField="hotelAllocation"
            label="Hotel Allocation"
            onChange={updateForm}
            value={form.hotelAllocation}
          />
          <Textarea
            formField="notes"
            label="Special Requests"
            onChange={updateForm}
            value={form.notes}
          />
        </>
      )}
    </>
  );
}
