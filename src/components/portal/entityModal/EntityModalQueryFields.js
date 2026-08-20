"use client";

import {
  Input,
  MAX_QUERY_NOTES_WORDS,
  QueryFilePicker,
  Select,
  Textarea,
} from "@/components/portal/PortalModalForm";
import {
  QUERY_SOURCES,
  SALES_REP_ROLES,
  TICKETING_SCOPE_OPTIONS,
  TRAVEL_TYPES,
} from "@/lib/portal/constants";
import { getQueryTypeOptions } from "@/lib/portal/permissions";
import { propertiesWhen } from "../../../lib/runtimeValues";
import { EntityModalFieldSection } from "./EntityModalFieldSection";

const TICKETING_SCOPE_SELECT_OPTIONS = [
  { label: "Select Ticketing Scope...", value: "" },
  ...TICKETING_SCOPE_OPTIONS.map((scope) => ({ label: scope, value: scope })),
];

const TRAVEL_IN_BATCHES_OPTIONS = [
  { label: "No", value: "No" },
  { label: "Yes", value: "Yes" },
];

export function EntityModalQueryFields({
  modal,
  form,
  updateForm,
  patchForm,
  access,
  team,
  contractingTeamOptions,
  pendingQueryFiles,
  setPendingQueryFiles,
  fieldErrors = {},
}) {
  const handleSalesOwner = (staffId) => {
    const selected = team.find((member) => String(member.id) === String(staffId));
    patchForm({
      salesOwnerName: selected?.name || "",
      salesOwnerStaffId: staffId,
    });
  };
  const handleTravelInBatches = (value) =>
    patchForm({
      travelInBatches: value,
      ...propertiesWhen(value !== "Yes", () => ({ batchingNotes: "" })),
    });

  if (modal !== "query") {
    return null;
  }

  return (
    <div className="space-y-4 md:col-span-2">
      <EntityModalFieldSection
        description="Identify the client and enquiry source."
        eyebrow="01 · Enquiry"
        title="Client and contact"
      >
        <Input
          data-entity-modal-autofocus
          error={fieldErrors.clientName}
          fieldKey="clientName"
          formField="clientName"
          label="Client / Company"
          onChange={updateForm}
          required
          value={form.clientName}
        />
        <Input
          formField="contactPerson"
          label="Contact Person"
          onChange={updateForm}
          value={form.contactPerson}
        />
        <Input
          formField="contactMobile"
          label="Mobile"
          onChange={updateForm}
          value={form.contactMobile}
        />
        <Select
          formField="source"
          label="Source"
          onChange={updateForm}
          options={QUERY_SOURCES}
          value={form.source}
        />
        <Select
          label="Sales Rep"
          onChange={handleSalesOwner}
          options={[
            { label: "Current user", value: "" },
            ...team.reduce((options, member) => {
              if (member.roles.some((role) => SALES_REP_ROLES.includes(role))) {
                options.push({ label: member.name, value: member.id });
              }
              return options;
            }, []),
          ]}
          value={
            form.salesOwnerStaffId ||
            team.find((member) => member.name === form.salesOwnerName)?.id ||
            ""
          }
        />
      </EntityModalFieldSection>

      <EntityModalFieldSection
        description="Summarize the request for initial Sales and Contracting review."
        eyebrow="02 · Trip brief"
        title="Travel requirements"
      >
        <Select
          formField="queryType"
          label="Query Type"
          onChange={updateForm}
          options={getQueryTypeOptions(access)}
          value={form.queryType}
        />
        <Select
          formField="travelType"
          label="Travel Type"
          onChange={updateForm}
          options={TRAVEL_TYPES}
          value={form.travelType}
        />
        <Input
          formField="destination"
          label="Destination"
          onChange={updateForm}
          value={form.destination}
        />
        <Input
          error={fieldErrors.paxCount}
          fieldKey="paxCount"
          formField="paxCount"
          label="No. of Pax"
          onChange={updateForm}
          type="number"
          value={form.paxCount}
        />
        <Input
          error={fieldErrors.travelStartDate}
          fieldKey="travelStartDate"
          formField="travelStartDate"
          label="Travel Date From"
          onChange={updateForm}
          type="date"
          value={form.travelStartDate}
        />
        <Input
          error={fieldErrors.travelEndDate}
          fieldKey="travelEndDate"
          formField="travelEndDate"
          label="Travel Date To"
          onChange={updateForm}
          type="date"
          value={form.travelEndDate}
        />
        <Input
          error={fieldErrors.budgetAmount}
          fieldKey="budgetAmount"
          formField="budgetAmount"
          label="Budget per Person (INR, pre-tax)"
          onChange={updateForm}
          type="number"
          value={form.budgetAmount}
        />
      </EntityModalFieldSection>

      <EntityModalFieldSection
        description="Choose the initial Contracting and Ticketing handoff."
        eyebrow="03 · Handoff"
        title="Delivery coordination"
      >
        <Select
          error={fieldErrors.staffId}
          fieldKey="staffId"
          formField="staffId"
          label="Contracting SPOC"
          onChange={updateForm}
          options={[
            { label: "Select Contracting SPOC...", value: "" },
            ...contractingTeamOptions.map((option) => ({
              label: option.label,
              value: option.value,
            })),
          ]}
          value={form.staffId}
        />
        <Select
          error={fieldErrors.ticketingScope}
          fieldKey="ticketingScope"
          formField="ticketingScope"
          label="Ticketing Scope"
          onChange={updateForm}
          options={TICKETING_SCOPE_SELECT_OPTIONS}
          value={form.ticketingScope}
        />
        <Select
          label="Travel in Series"
          onChange={handleTravelInBatches}
          options={TRAVEL_IN_BATCHES_OPTIONS}
          value={form.travelInBatches || "No"}
        />
        {form.travelInBatches === "Yes" ? (
          <Textarea
            formField="batchingNotes"
            label="Batch Details"
            onChange={updateForm}
            value={form.batchingNotes}
          />
        ) : null}
      </EntityModalFieldSection>

      <EntityModalFieldSection
        description="Add only the context and source documents the delivery teams need for their first pass."
        eyebrow="04 · Context"
        title="Notes and files"
      >
        <Textarea
          error={fieldErrors.notes}
          fieldKey="notes"
          formField="notes"
          label="Notes"
          maxWords={MAX_QUERY_NOTES_WORDS}
          onChange={updateForm}
          value={form.notes}
        />
        <div className="md:col-span-2">
          <QueryFilePicker
            files={pendingQueryFiles}
            inputId="new-query-files"
            onChange={setPendingQueryFiles}
          />
        </div>
      </EntityModalFieldSection>
    </div>
  );
}
