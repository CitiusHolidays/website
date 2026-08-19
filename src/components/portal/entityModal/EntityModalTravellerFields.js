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
            label="Travel Batch"
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
