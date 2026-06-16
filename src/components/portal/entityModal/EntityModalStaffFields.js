"use client";

import { Input, MultiSelect, Select } from "@/components/portal/PortalModalForm";
import { PORTAL_ROLES } from "@/lib/portal/constants";

function staffOptionsExcluding(team, excludedId) {
  return team.reduce((options, member) => {
    if (member.id !== excludedId) {
      options.push({ value: member.id, label: member.name });
    }
    return options;
  }, []);
}

export function EntityModalStaffFields({
  modal,
  form,
  updateForm,
  patchForm,
  has,
  access,
  jobCards,
  travellers,
  visas,
  pnrs,
  team,
  travellersWithoutVisa,
  travellerOptions,
  pnrOptions,
  tourManagerOptions,
  leaveHeadApproverOptions,
  leaveImpact,
  pendingExpenseProofFiles,
  setPendingExpenseProofFiles,
  handleJobCardSelect,
  handleTravellerSelect,
  handlePnrSelect,
  handleVisaRecordSelect,
  handleStaffSelect,
}) {
  return (
    <>
      {modal === "staff" && (
        <>
          <Input
            label="Name"
            value={form.staffName}
            onChange={(v) => updateForm("staffName", v)}
            required
          />
          <Input
            label="Email"
            type="email"
            value={form.staffEmail}
            onChange={(v) => updateForm("staffEmail", v)}
            required
          />
          <Input label="Mobile" value={form.mobile} onChange={(v) => updateForm("mobile", v)} />
          <Input
            label="Department"
            value={form.department}
            onChange={(v) => updateForm("department", v)}
          />
          <Input
            label="Function"
            value={form.staffFunction}
            onChange={(v) => updateForm("staffFunction", v)}
          />
          <Input
            label="Location"
            value={form.location}
            onChange={(v) => updateForm("location", v)}
          />
          <Input
            label="Confirmation Date"
            type="date"
            value={form.confirmationDate}
            onChange={(v) => updateForm("confirmationDate", v)}
          />
          <Input
            label="Leave Policy Group"
            value={form.leavePolicyGroup}
            onChange={(v) => updateForm("leavePolicyGroup", v)}
            placeholder="Default"
          />
          <Select
            label="Leave Head Approver"
            value={form.leaveHeadApproverId}
            options={leaveHeadApproverOptions}
            onChange={(v) => updateForm("leaveHeadApproverId", v)}
          />
          <Select
            label="Reporting Manager"
            value={form.reportingManagerStaffId}
            options={[
              { value: "", label: form.reportingManagerName || "Select reporting manager..." },
              ...staffOptionsExcluding(team, form.staffId),
            ]}
            onChange={(v) => updateForm("reportingManagerStaffId", v)}
          />
          <div className="md:col-span-2 rounded-xl border border-brand-border bg-brand-light/70 px-4 py-3 text-sm text-brand-muted">
            First approval goes to this head or director. HR always gives the second approval after
            the head approves.
          </div>
          <Input
            label="Maternity Events Used"
            type="number"
            value={form.maternityEventsUsed}
            onChange={(v) => updateForm("maternityEventsUsed", v)}
          />
          <Input
            label="Paternity Events Used"
            type="number"
            value={form.paternityEventsUsed}
            onChange={(v) => updateForm("paternityEventsUsed", v)}
          />
          <Select
            label="Marriage Leave Used"
            value={form.marriageLeaveUsed ? "Yes" : "No"}
            options={["No", "Yes"]}
            onChange={(v) => updateForm("marriageLeaveUsed", v === "Yes")}
          />
          <MultiSelect
            label="Roles"
            value={form.staffRoles}
            options={PORTAL_ROLES}
            onChange={(v) => updateForm("staffRoles", v)}
          />
          <Select
            label="Active"
            value={form.staffActive ? "Active" : "Inactive"}
            options={["Active", "Inactive"]}
            onChange={(v) => updateForm("staffActive", v === "Active")}
          />
        </>
      )}
    </>
  );
}
