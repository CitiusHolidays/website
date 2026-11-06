"use client";

import { Input, MultiSelect, Select } from "@/components/portal/PortalModalForm";
import { PORTAL_ROLES } from "@/lib/portal/constants";
import { EntityModalFieldSection } from "./EntityModalFieldSection";

function staffOptionsExcluding(team, excludedId) {
  return team.reduce((options, member) => {
    if (member.id !== excludedId) {
      options.push({ label: member.name, value: member.id });
    }
    return options;
  }, []);
}

export function EntityModalStaffFields({
  disabled = false,
  modal,
  form,
  updateForm,

  team,

  leaveHeadApproverOptions,
}) {
  const handleMarriageLeaveUsed = (value) => updateForm("marriageLeaveUsed", value === "Yes");
  const handleStaffActive = (value) => updateForm("staffActive", value === "Active");
  if (modal !== "staff") {
    return null;
  }
  return (
    <>
      <EntityModalFieldSection title="Person">
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
        <Input formField="location" label="Location" onChange={updateForm} value={form.location} />
      </EntityModalFieldSection>
      <EntityModalFieldSection title="Work and reporting">
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
        <Select
          formField="reportingManagerStaffId"
          label="Reporting manager"
          onChange={updateForm}
          options={[
            { label: form.reportingManagerName || "Select reporting manager...", value: "" },
            ...staffOptionsExcluding(team, form.staffId),
          ]}
          value={form.reportingManagerStaffId}
        />
        <Input
          formField="confirmationDate"
          label="Confirmation date"
          onChange={updateForm}
          type="date"
          value={form.confirmationDate}
        />
      </EntityModalFieldSection>
      <EntityModalFieldSection
        description="First approval goes to this head or director. HR always gives the second approval after the head approves."
        title="Leave approval and entitlements"
      >
        <Select
          formField="leaveHeadApproverId"
          label="Leave head approver"
          onChange={updateForm}
          options={leaveHeadApproverOptions}
          value={form.leaveHeadApproverId}
        />
        <Input
          formField="leavePolicyGroup"
          label="Leave policy group"
          onChange={updateForm}
          placeholder="Default"
          value={form.leavePolicyGroup}
        />
        <Input
          formField="maternityEventsUsed"
          label="Maternity leave taken (times)"
          onChange={updateForm}
          type="number"
          value={form.maternityEventsUsed}
        />
        <Input
          formField="paternityEventsUsed"
          label="Paternity leave taken (times)"
          onChange={updateForm}
          type="number"
          value={form.paternityEventsUsed}
        />
        <Select
          label="Marriage leave taken"
          onChange={handleMarriageLeaveUsed}
          options={["No", "Yes"]}
          value={form.marriageLeaveUsed ? "Yes" : "No"}
        />
      </EntityModalFieldSection>
      <EntityModalFieldSection title="Access and email alerts">
        <Select
          label="Active"
          onChange={handleStaffActive}
          options={["Active", "Inactive"]}
          value={form.staffActive ? "Active" : "Inactive"}
        />
        <MultiSelect
          disabled={disabled}
          formField="staffRoles"
          label="Roles"
          onChange={updateForm}
          options={PORTAL_ROLES}
          value={form.staffRoles}
        />
        <MultiSelect
          disabled={disabled}
          formField="emailAlertRoles"
          help="Portal roles keep their standard email alerts. Additional roles add email coverage without changing portal access or bell notifications."
          label="Additional email alert roles"
          onChange={updateForm}
          options={PORTAL_ROLES}
          value={form.emailAlertRoles || []}
        />
      </EntityModalFieldSection>
    </>
  );
}
