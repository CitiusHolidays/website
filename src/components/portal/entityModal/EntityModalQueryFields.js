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
}) {
  if (modal !== "query") {
    return null;
  }

  return (
    <div className="space-y-4 md:col-span-2">
      <EntityModalFieldSection
        description="Start with the person and source behind the enquiry. Required fields are marked with an asterisk."
        eyebrow="01 · Enquiry"
        title="Client and contact"
      >
        <Input
          data-entity-modal-autofocus
          label="Client / Company"
          onChange={(v) => updateForm("clientName", v)}
          required
          value={form.clientName}
        />
        <Input
          label="Contact Person"
          onChange={(v) => updateForm("contactPerson", v)}
          value={form.contactPerson}
        />
        <Input
          label="Mobile"
          onChange={(v) => updateForm("contactMobile", v)}
          value={form.contactMobile}
        />
        <Select
          label="Source"
          onChange={(v) => updateForm("source", v)}
          options={QUERY_SOURCES}
          value={form.source}
        />
        <Select
          label="Sales Rep"
          onChange={(staffId) => {
            const selected = team.find((member) => String(member.id) === String(staffId));
            patchForm({
              salesOwnerName: selected?.name || "",
              salesOwnerStaffId: staffId,
            });
          }}
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
        description="Describe the travel request at the level needed for an initial sales and contracting review."
        eyebrow="02 · Trip brief"
        title="Travel requirements"
      >
        <Select
          label="Query Type"
          onChange={(v) => updateForm("queryType", v)}
          options={getQueryTypeOptions(access)}
          value={form.queryType}
        />
        <Select
          label="Travel Type"
          onChange={(v) => updateForm("travelType", v)}
          options={TRAVEL_TYPES}
          value={form.travelType}
        />
        <Input
          label="Destination"
          onChange={(v) => updateForm("destination", v)}
          value={form.destination}
        />
        <Input
          label="No. of Pax"
          onChange={(v) => updateForm("paxCount", v)}
          type="number"
          value={form.paxCount}
        />
        <Input
          label="Travel Date From"
          onChange={(v) => updateForm("travelStartDate", v)}
          type="date"
          value={form.travelStartDate}
        />
        <Input
          label="Travel Date To"
          onChange={(v) => updateForm("travelEndDate", v)}
          type="date"
          value={form.travelEndDate}
        />
        <Input
          label="Budget per Person (INR, pre-tax)"
          onChange={(v) => updateForm("budgetAmount", v)}
          type="number"
          value={form.budgetAmount}
        />
      </EntityModalFieldSection>

      <EntityModalFieldSection
        description="Set the initial handoff context. These choices can still be updated through the existing assignment workflow."
        eyebrow="03 · Handoff"
        title="Delivery coordination"
      >
        <Select
          label="Contracting SPOC"
          onChange={(v) => updateForm("staffId", v)}
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
          label="Ticketing Scope"
          onChange={(v) => updateForm("ticketingScope", v)}
          options={TICKETING_SCOPE_SELECT_OPTIONS}
          value={form.ticketingScope}
        />
        <Select
          label="Travel in Series"
          onChange={(v) =>
            patchForm({
              travelInBatches: v,
              ...(v === "Yes" ? {} : { batchingNotes: "" }),
            })
          }
          options={TRAVEL_IN_BATCHES_OPTIONS}
          value={form.travelInBatches || "No"}
        />
        {form.travelInBatches === "Yes" ? (
          <Textarea
            label="Batch Details"
            onChange={(v) => updateForm("batchingNotes", v)}
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
          label="Notes"
          maxWords={MAX_QUERY_NOTES_WORDS}
          onChange={(v) => updateForm("notes", v)}
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
