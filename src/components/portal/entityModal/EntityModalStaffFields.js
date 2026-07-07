"use client";

import { Input, MultiSelect, Select } from "@/components/portal/PortalModalForm";
import { PORTAL_ROLES } from "@/lib/portal/constants";

function staffOptionsExcluding(team, excludedId) {
  return team.reduce((options, member) => {
    if (member.id !== excludedId) {
      options.push({ label: member.name, value: member.id });
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
            onChange={(v) => updateForm("staffName", v)}
            required
            value={form.staffName}
          />
          <Input
            label="Email"
            onChange={(v) => updateForm("staffEmail", v)}
            required
            type="email"
            value={form.staffEmail}
          />
          <Input label="Mobile" onChange={(v) => updateForm("mobile", v)} value={form.mobile} />
          <Input
            label="Department"
            onChange={(v) => updateForm("department", v)}
            value={form.department}
          />
          <Input
            label="Function"
            onChange={(v) => updateForm("staffFunction", v)}
            value={form.staffFunction}
          />
          <Input
            label="Location"
            onChange={(v) => updateForm("location", v)}
            value={form.location}
          />
          <Input
            label="Confirmation Date"
            onChange={(v) => updateForm("confirmationDate", v)}
            type="date"
            value={form.confirmationDate}
          />
          <Input
            label="Leave Policy Group"
            onChange={(v) => updateForm("leavePolicyGroup", v)}
            placeholder="Default"
            value={form.leavePolicyGroup}
          />
          <Select
            label="Leave Head Approver"
            onChange={(v) => updateForm("leaveHeadApproverId", v)}
            options={leaveHeadApproverOptions}
            value={form.leaveHeadApproverId}
          />
          <Select
            label="Reporting Manager"
            onChange={(v) => updateForm("reportingManagerStaffId", v)}
            options={[
              { label: form.reportingManagerName || "Select reporting manager...", value: "" },
              ...staffOptionsExcluding(team, form.staffId),
            ]}
            value={form.reportingManagerStaffId}
          />
          <div className="rounded-xl border border-brand-border bg-brand-light/70 px-4 py-3 text-brand-muted text-sm md:col-span-2">
            First approval goes to this head or director. HR always gives the second approval after
            the head approves.
          </div>
          <Input
            label="Maternity Events Used"
            onChange={(v) => updateForm("maternityEventsUsed", v)}
            type="number"
            value={form.maternityEventsUsed}
          />
          <Input
            label="Paternity Events Used"
            onChange={(v) => updateForm("paternityEventsUsed", v)}
            type="number"
            value={form.paternityEventsUsed}
          />
          <Select
            label="Marriage Leave Used"
            onChange={(v) => updateForm("marriageLeaveUsed", v === "Yes")}
            options={["No", "Yes"]}
            value={form.marriageLeaveUsed ? "Yes" : "No"}
          />
          <MultiSelect
            label="Roles"
            onChange={(v) => updateForm("staffRoles", v)}
            options={PORTAL_ROLES}
            value={form.staffRoles}
          />
          <Select
            label="Active"
            onChange={(v) => updateForm("staffActive", v === "Active")}
            options={["Active", "Inactive"]}
            value={form.staffActive ? "Active" : "Inactive"}
          />
        </>
      )}
    </>
  );
}
