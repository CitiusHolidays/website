"use client";

import { Input, Select, Textarea } from "@/components/portal/PortalModalForm";
import { jobCardSelectOptions, travelBatchSelectOptions } from "@/lib/portal/entityModalLinks";

export function EntityModalTourManagerFields({
  modal,
  form,
  updateForm,

  jobCards,

  tourManagerOptions,

  handleJobCardSelect,

  handleStaffSelect,
}) {
  const handleTourManager = (value) => handleStaffSelect("staffId", value);
  return (
    <>
      {modal === "tourManager" && (
        <>
          <Select
            label="Job Card"
            onChange={handleJobCardSelect}
            options={jobCardSelectOptions(jobCards, { required: true })}
            required
            value={form.jobCardId}
          />
          {form.jobCardId ? (
            <Select
              formField="travelBatchId"
              label="Travel in Series"
              onChange={updateForm}
              options={travelBatchSelectOptions(jobCards, form.jobCardId)}
              value={form.travelBatchId || ""}
            />
          ) : null}
          <Select
            label="Tour Manager"
            onChange={handleTourManager}
            options={[
              { label: "Select tour manager…", value: "" },
              ...tourManagerOptions.map((o) => ({ label: o.label, value: o.value })),
            ]}
            required
            value={form.staffId}
          />
          <Input
            formField="staffEmail"
            label="Email"
            onChange={updateForm}
            value={form.staffEmail}
          />
          <Input formField="paidBy" label="Phone" onChange={updateForm} value={form.paidBy} />
          <Input
            formField="travelStartDate"
            label="Available Date"
            onChange={updateForm}
            type="date"
            value={form.travelStartDate}
          />
          <Textarea
            formField="reportingInstructions"
            label="Reporting Instructions"
            onChange={updateForm}
            value={form.reportingInstructions || ""}
          />
          <Textarea formField="notes" label="Notes" onChange={updateForm} value={form.notes} />
        </>
      )}
    </>
  );
}
