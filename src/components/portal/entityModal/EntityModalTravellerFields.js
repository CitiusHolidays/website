"use client";

import { api } from "@convex/_generated/api";
import { Input, Select, Textarea } from "@/components/portal/PortalModalForm";
import {
  FOOD_PREFERENCES,
  GENDER_OPTIONS,
  GUEST_TYPES,
  PAYMENT_TYPES,
  ROOM_TYPES,
} from "@/lib/portal/constants";
import { jobCardSelectOptions, travelBatchSelectOptions } from "@/lib/portal/entityModalLinks";
import { useTrackedQuery as useQuery } from "@/lib/portal/trackedConvexSubscriptions";
import { EntityModalFieldSection } from "./EntityModalFieldSection";

const AGE_GROUP_OPTIONS = [
  { label: "Not recorded", value: "" },
  { label: "Adult", value: "adult" },
  { label: "Minor (under 18 on the trip start date)", value: "minor" },
];

/** Minor status and guardian (ADR 0018): an adult traveller on the same Job Card. */
function TravellerGuardianFields({ form, updateForm }) {
  const isMinor = form.ageGroup === "minor";
  const options = useQuery(
    api.crm.travellers.listGuardianOptions,
    isMinor && form.entityId ? { travellerId: form.entityId } : "skip"
  );
  let guardianField = null;
  if (isMinor && form.entityId) {
    guardianField = (
      <Select
        formField="guardianTravellerId"
        label="Parent / guardian"
        onChange={updateForm}
        options={[
          { label: options ? "No guardian linked" : "Loading travellers…", value: "" },
          ...(options ?? []).map((option) => ({ label: option.fullName, value: option.id })),
        ]}
        value={form.guardianTravellerId || ""}
      />
    );
  } else if (isMinor) {
    guardianField = (
      <p className="font-sans text-brand-muted text-xs">
        Save this traveller first, then choose their parent or guardian.
      </p>
    );
  }
  return (
    <EntityModalFieldSection title="Minor and guardian">
      <Select
        formField="ageGroup"
        label="Age group"
        onChange={updateForm}
        options={AGE_GROUP_OPTIONS}
        value={form.ageGroup || ""}
      />
      {guardianField}
      <p className="col-span-full font-sans text-brand-muted text-xs">
        A minor has no login of their own; the guardian must be an adult on this Job Card.
      </p>
    </EntityModalFieldSection>
  );
}

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
        <div className="space-y-6 md:col-span-2">
          <EntityModalFieldSection title="Traveller and trip">
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
          </EntityModalFieldSection>
          <TravellerGuardianFields form={form} updateForm={updateForm} />
          <EntityModalFieldSection title="Guest contact">
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
          </EntityModalFieldSection>
          <EntityModalFieldSection title="Travel and requirements">
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
          </EntityModalFieldSection>
        </div>
      )}
    </>
  );
}
