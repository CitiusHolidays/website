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
        <Input label="Batch reference" value={form.batchReference} onChange={() => {}} readOnly />
      ) : null}
      {form.entityId ? (
        <Input
          label="Job Card"
          value={jobCards.find((job) => job.id === form.jobCardId)?.jobCode || form.jobCardId || ""}
          onChange={() => {}}
          readOnly
        />
      ) : (
        <Select
          label="Job Card"
          value={form.jobCardId}
          options={jobCardSelectOptions(jobCards, { required: true })}
          onChange={handleJobCardSelect}
          required
        />
      )}
      <Input
        label="Destination"
        value={form.destination}
        onChange={(value) => updateForm("destination", value)}
      />
      <Input
        label="Confirmed Pax"
        type="number"
        value={form.confirmedPax}
        onChange={(value) => updateForm("confirmedPax", value)}
      />
      <Input
        label="Room Count"
        type="number"
        value={form.roomCount}
        onChange={(value) => updateForm("roomCount", value)}
      />
      <Input
        label="Travel Start"
        type="date"
        value={form.travelStartDate}
        onChange={(value) => updateForm("travelStartDate", value)}
      />
      <Input
        label="Travel End"
        type="date"
        value={form.travelEndDate}
        onChange={(value) => updateForm("travelEndDate", value)}
      />
      <Select
        label="Contracting SPOC"
        value={form.contractingOwnerId}
        options={[
          { value: "", label: "Unassigned" },
          ...contractingTeamOptions.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        ]}
        onChange={(value) =>
          setOwner("contractingOwnerId", "contractingOwnerName", value, contractingTeamOptions)
        }
      />
      <Select
        label="Operations SPOC"
        value={form.operationsOwnerId}
        options={[
          { value: "", label: "Unassigned" },
          ...operationsTeamOptions.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        ]}
        onChange={(value) =>
          setOwner("operationsOwnerId", "operationsOwnerName", value, operationsTeamOptions)
        }
      />
      <Select
        label="Ticketing SPOC"
        value={form.ticketingOwnerId}
        options={[
          { value: "", label: "Unassigned" },
          ...ticketingTeamOptions.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        ]}
        onChange={(value) =>
          setOwner("ticketingOwnerId", "ticketingOwnerName", value, ticketingTeamOptions)
        }
      />
      <Input
        label="Tour Manager"
        value={form.tourManagerName}
        onChange={(value) => updateForm("tourManagerName", value)}
      />
      <Select
        label="Status"
        value={form.status}
        options={JOB_CARD_STATUSES.map((status) => ({ value: status, label: status }))}
        onChange={(value) => updateForm("status", value)}
      />
    </>
  );
}
