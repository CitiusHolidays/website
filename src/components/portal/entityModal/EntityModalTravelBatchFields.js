"use client";

import { Input, Select } from "@/components/portal/PortalModalForm";
import { JOB_CARD_STATUSES } from "@/lib/portal/constants";
import { jobCardSelectOptions } from "@/lib/portal/entityModalLinks";

function keepReadOnlyValue() {
  return null;
}

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
  const handleContractingOwner = (staffId) => {
    const member = contractingTeamOptions.find((entry) => entry.value === staffId);
    patchForm({
      contractingOwnerId: staffId,
      contractingOwnerName: member?.label || "",
    });
  };
  const handleOperationsOwner = (staffId) => {
    const member = operationsTeamOptions.find((entry) => entry.value === staffId);
    patchForm({
      operationsOwnerId: staffId,
      operationsOwnerName: member?.label || "",
    });
  };
  const handleTicketingOwner = (staffId) => {
    const member = ticketingTeamOptions.find((entry) => entry.value === staffId);
    patchForm({
      ticketingOwnerId: staffId,
      ticketingOwnerName: member?.label || "",
    });
  };

  if (modal !== "travelBatch") {
    return null;
  }

  return (
    <>
      {form.batchReference ? (
        <Input
          label="Series reference"
          onChange={keepReadOnlyValue}
          readOnly
          value={form.batchReference}
        />
      ) : null}
      {form.entityId ? (
        <Input
          label="Job Card"
          onChange={keepReadOnlyValue}
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
        formField="destination"
        label="Destination"
        onChange={updateForm}
        value={form.destination}
      />
      <Input
        formField="confirmedPax"
        label="Confirmed Pax"
        onChange={updateForm}
        type="number"
        value={form.confirmedPax}
      />
      <Input
        formField="roomCount"
        label="Room Count"
        onChange={updateForm}
        type="number"
        value={form.roomCount}
      />
      <Input
        formField="travelStartDate"
        label="Travel Start"
        onChange={updateForm}
        type="date"
        value={form.travelStartDate}
      />
      <Input
        formField="travelEndDate"
        label="Travel End"
        onChange={updateForm}
        type="date"
        value={form.travelEndDate}
      />
      <Select
        label="Contracting SPOC"
        onChange={handleContractingOwner}
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
        onChange={handleOperationsOwner}
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
        onChange={handleTicketingOwner}
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
        formField="tourManagerName"
        label="Tour Manager"
        onChange={updateForm}
        value={form.tourManagerName}
      />
      <Select
        formField="status"
        label="Status"
        onChange={updateForm}
        options={JOB_CARD_STATUSES.map((status) => ({ label: status, value: status }))}
        value={form.status}
      />
    </>
  );
}
