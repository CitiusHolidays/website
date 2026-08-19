"use client";

import { useCallback } from "react";
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

  team,

  leaveHeadApproverOptions,
}) {
  const handleMarriageLeaveUsed = useCallback(
    (value) => updateForm("marriageLeaveUsed", value === "Yes"),
    [updateForm]
  );
  const handleStaffActive = useCallback(
    (value) => updateForm("staffActive", value === "Active"),
    [updateForm]
  );
  return (
    <>
      {modal === "staff" && (
        <>
          <Input
            formField="staffName"
            label="Name"
            onChange={updateForm}
            required
            value={form.staffName}
          />
          <Input
            formField="staffEmail"
            label="Email"
            onChange={updateForm}
            required
            type="email"
            value={form.staffEmail}
          />
          <Input formField="mobile" label="Mobile" onChange={updateForm} value={form.mobile} />
          <Input
            formField="department"
            label="Department"
            onChange={updateForm}
            value={form.department}
          />
          <Input
            formField="staffFunction"
            label="Function"
            onChange={updateForm}
            value={form.staffFunction}
          />
          <Input
            formField="location"
            label="Location"
            onChange={updateForm}
            value={form.location}
          />
          <Input
            formField="confirmationDate"
            label="Confirmation Date"
            onChange={updateForm}
            type="date"
            value={form.confirmationDate}
          />
          <Input
            formField="leavePolicyGroup"
            label="Leave Policy Group"
            onChange={updateForm}
            placeholder="Default"
            value={form.leavePolicyGroup}
          />
          <Select
            formField="leaveHeadApproverId"
            label="Leave Head Approver"
            onChange={updateForm}
            options={leaveHeadApproverOptions}
            value={form.leaveHeadApproverId}
          />
          <Select
            formField="reportingManagerStaffId"
            label="Reporting Manager"
            onChange={updateForm}
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
            formField="maternityEventsUsed"
            label="Maternity Events Used"
            onChange={updateForm}
            type="number"
            value={form.maternityEventsUsed}
          />
          <Input
            formField="paternityEventsUsed"
            label="Paternity Events Used"
            onChange={updateForm}
            type="number"
            value={form.paternityEventsUsed}
          />
          <Select
            label="Marriage Leave Used"
            onChange={handleMarriageLeaveUsed}
            options={["No", "Yes"]}
            value={form.marriageLeaveUsed ? "Yes" : "No"}
          />
          <MultiSelect
            formField="staffRoles"
            label="Roles"
            onChange={updateForm}
            options={PORTAL_ROLES}
            value={form.staffRoles}
          />
          <MultiSelect
            formField="emailAlertRoles"
            help="Portal roles keep their standard email alerts. Additional roles add email coverage without changing portal access or bell notifications."
            label="Additional email alert roles"
            onChange={updateForm}
            options={PORTAL_ROLES}
            value={form.emailAlertRoles || []}
          />
          <Select
            label="Active"
            onChange={handleStaffActive}
            options={["Active", "Inactive"]}
            value={form.staffActive ? "Active" : "Inactive"}
          />
        </>
      )}
    </>
  );
}
