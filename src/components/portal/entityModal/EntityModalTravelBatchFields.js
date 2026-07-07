"use client";

import { Input, Select } from "@/components/portal/PortalModalForm";
import { JOB_CARD_STATUSES } from "@/lib/portal/constants";
import { jobCardSelectOptions } from "@/lib/portal/entityModalLinks";

export function EntityModalTravelBatchFields({
  modal,
  form,
  updateForm,
  patchForm,
  jobCards,
  contractingTeamOptions,
  operationsTeamOptions,
  ticketingTeamOptions,
  handleJobCardSelect,
}) {
  if (modal !== "travelBatch") {
    return null;
  }

  const setOwner = (idField, nameField, staffId, options) => {
    const member = options.find((entry) => entry.value === staffId);
    patchForm({
      [idField]: staffId,
      [nameField]: member?.label || "",
    });
  };

  return (
    <>
      {form.batchReference ? (
        <Input label="Batch reference" onChange={() => {}} readOnly value={form.batchReference} />
      ) : null}
      {form.entityId ? (
        <Input
          label="Job Card"
          onChange={() => {}}
          readOnly
          value={jobCards.find((job) => job.id === form.jobCardId)?.jobCode || form.jobCardId || ""}
        />
      ) : (
        <Select
          label="Job Card"
          onChange={handleJobCardSelect}
          options={jobCardSelectOptions(jobCards, { required: true })}
          required
          value={form.jobCardId}
        />
      )}
      <Input
        label="Destination"
        onChange={(value) => updateForm("destination", value)}
        value={form.destination}
      />
      <Input
        label="Confirmed Pax"
        onChange={(value) => updateForm("confirmedPax", value)}
        type="number"
        value={form.confirmedPax}
      />
      <Input
        label="Room Count"
        onChange={(value) => updateForm("roomCount", value)}
        type="number"
        value={form.roomCount}
      />
      <Input
        label="Travel Start"
        onChange={(value) => updateForm("travelStartDate", value)}
        type="date"
        value={form.travelStartDate}
      />
      <Input
        label="Travel End"
        onChange={(value) => updateForm("travelEndDate", value)}
        type="date"
        value={form.travelEndDate}
      />
      <Select
        label="Contracting SPOC"
        onChange={(value) =>
          setOwner("contractingOwnerId", "contractingOwnerName", value, contractingTeamOptions)
        }
        options={[
          { label: "Unassigned", value: "" },
          ...contractingTeamOptions.map((option) => ({
            label: option.label,
            value: option.value,
          })),
        ]}
        value={form.contractingOwnerId}
      />
      <Select
        label="Operations SPOC"
        onChange={(value) =>
          setOwner("operationsOwnerId", "operationsOwnerName", value, operationsTeamOptions)
        }
        options={[
          { label: "Unassigned", value: "" },
          ...operationsTeamOptions.map((option) => ({
            label: option.label,
            value: option.value,
          })),
        ]}
        value={form.operationsOwnerId}
      />
      <Select
        label="Ticketing SPOC"
        onChange={(value) =>
          setOwner("ticketingOwnerId", "ticketingOwnerName", value, ticketingTeamOptions)
        }
        options={[
          { label: "Unassigned", value: "" },
          ...ticketingTeamOptions.map((option) => ({
            label: option.label,
            value: option.value,
          })),
        ]}
        value={form.ticketingOwnerId}
      />
      <Input
        label="Tour Manager"
        onChange={(value) => updateForm("tourManagerName", value)}
        value={form.tourManagerName}
      />
      <Select
        label="Status"
        onChange={(value) => updateForm("status", value)}
        options={JOB_CARD_STATUSES.map((status) => ({ label: status, value: status }))}
        value={form.status}
      />
    </>
  );
}
