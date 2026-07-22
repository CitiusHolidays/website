"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { usePortalToast } from "@/components/portal/PortalToast";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { EmptyState, LoadingPanel } from "../portalAdminHelpers";
import { filterDropdowns, onboardingActionLabel } from "../portalAdminUtils";
import type { PortalStaffSettingsRow, SettingsViewProps } from "../portalViewTypes";
import { formatConvexError, strong } from "../portalWorkspaceListHelpers";
import { Badge, DeleteButton, Panel } from "../portalWorkspaceListUi";

type StaffRow = PortalStaffSettingsRow;

const LazyStaffWorkbookImportPanel = dynamic(
  () =>
    import("@/components/portal/settings/StaffWorkbookImportPanel").then(
      (module) => module.StaffWorkbookImportPanel
    ),
  { loading: () => <LoadingPanel />, ssr: false }
);

const useTypedPortalToast = usePortalToast as unknown as () => {
  error: (message: string) => unknown;
  success: (message: string) => unknown;
};

export function SettingsView({
  staff,
  dropdowns,
  search,
  openModal,
  deleteItem,
  removeStaff,
  startStaffOnboarding,
}: SettingsViewProps) {
  const toast = useTypedPortalToast();
  const [onboardingSending, setOnboardingSending] = useState<Record<string, boolean>>({});
  const [showWorkbookImport, setShowWorkbookImport] = useState(false);

  const searchTerm = search.trim();
  const visibleDropdowns = filterDropdowns(dropdowns, search);

  const handleSendOnboarding = async (row: StaffRow) => {
    const rowId = String(row.id);
    setOnboardingSending((prev) => ({ ...prev, [rowId]: true }));
    try {
      const result = await startStaffOnboarding({ staffId: String(row.id) });
      toast.success(result?.message || `Onboarding email sent to ${row.email}.`);
    } catch (err) {
      console.error(err);
      toast.error(formatConvexError(err, "Failed to send onboarding email."));
    }
    setOnboardingSending((prev) => ({ ...prev, [rowId]: false }));
  };

  return (
    <div className="space-y-5">
      {showWorkbookImport ? (
        <LazyStaffWorkbookImportPanel />
      ) : (
        <section className="rounded-lg border border-brand-border bg-white p-5 shadow-sm md:p-6">
          <h2 className="font-heading font-semibold text-citius-blue text-lg md:text-xl">
            Leave matrix workbook
          </h2>
          <p className="mt-1 max-w-2xl text-brand-muted text-sm">
            Load the workbook workflow only when you are ready to preview or apply staff changes.
          </p>
          <button
            className="portal-primary-btn mt-4"
            onClick={() => setShowWorkbookImport(true)}
            type="button"
          >
            Open workbook import
          </button>
        </section>
      )}
      <Panel title="Staff allowlist">
        <SelectableDataTable
          columns={[
            {
              id: "name",
              label: "Name",
              render: (row: StaffRow) => strong(row.name),
              sortValue: (row: StaffRow) => row.name,
            },
            {
              id: "email",
              label: "Email",
              render: (row: StaffRow) => row.email,
            },
            {
              id: "leave-head-approver",
              label: "Leave Head Approver",
              render: (row: StaffRow) => row.leaveHeadApproverName || "Matrix default",
            },
            {
              id: "reporting-manager",
              label: "Reporting Manager",
              render: (row: StaffRow) => row.reportingManagerName || "-",
            },
            {
              id: "department",
              label: "Department",
              render: (row: StaffRow) => row.department || "-",
            },
            {
              id: "function",
              label: "Function",
              render: (row: StaffRow) => row.function || "-",
            },
            {
              id: "location",
              label: "Location",
              render: (row: StaffRow) => row.location || "-",
            },
            {
              id: "roles",
              label: "Roles",
              render: (row: StaffRow) => row.roles.join(", "),
            },
            {
              id: "email-alerts",
              label: "Email alert roles",
              render: (row: StaffRow) =>
                row.emailAlertRoles && row.emailAlertRoles.length > 0
                  ? row.emailAlertRoles.join(", ")
                  : "No email alerts enabled",
            },
            {
              id: "onboarding",
              label: "Onboarding",
              render: (row: StaffRow) => (
                <Badge
                  label={
                    row.onboardingStatus === "ready"
                      ? "Ready"
                      : row.onboardingStatus === "pending"
                        ? "Pending"
                        : "Not started"
                  }
                  tone={
                    row.onboardingStatus === "ready"
                      ? "green"
                      : row.onboardingStatus === "pending"
                        ? "blue"
                        : "gray"
                  }
                />
              ),
            },
            {
              id: "active",
              label: "Active",
              render: (row: StaffRow) => (
                <Badge
                  label={row.active ? "Active" : "Inactive"}
                  tone={row.active ? "green" : "red"}
                />
              ),
            },
            {
              id: "action",
              kind: "action",
              label: "Action",
              render: (row: StaffRow) => (
                <div className="flex flex-wrap gap-2">
                  <button
                    className="portal-small-btn"
                    onClick={() =>
                      openModal("staff", {
                        confirmationDate: row.confirmationDate || "",
                        department: row.department,
                        emailAlertRoles: row.emailAlertRoles || [],
                        employmentStatus: row.employmentStatus || "Confirmed",
                        joiningDate: row.joiningDate || "",
                        leaveHeadApproverId: row.leaveHeadApproverId || "",
                        leavePolicyGroup: row.leavePolicyGroup || "",
                        location: row.location,
                        marriageLeaveUsed: Boolean(row.marriageLeaveUsed),
                        maternityEventsUsed: String(row.maternityEventsUsed ?? 0),
                        mobile: row.mobile,
                        paternityEventsUsed: String(row.paternityEventsUsed ?? 0),
                        reportingManagerName: row.reportingManagerName || "",
                        reportingManagerStaffId: row.reportingManagerStaffId || "",
                        staffActive: row.active,
                        staffEmail: row.email,
                        staffFunction: row.function,
                        staffId: row.id,
                        staffName: row.name,
                        staffRoles: row.roles,
                      })
                    }
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="portal-small-btn border-brand-border bg-brand-light text-brand-dark hover:bg-brand-light/70"
                    disabled={onboardingSending[String(row.id)]}
                    onClick={() => handleSendOnboarding(row)}
                    type="button"
                  >
                    {onboardingSending[String(row.id)] ? "Sending…" : onboardingActionLabel(row)}
                  </button>
                  <DeleteButton
                    label={row.email}
                    onClick={() => deleteItem(row.email, removeStaff, { staffId: String(row.id) })}
                  />
                </div>
              ),
            },
          ]}
          compact
          empty={searchTerm ? "No staff match your search." : "No staff records yet."}
          rows={staff}
        />
      </Panel>
      <Panel title="Workflow dropdowns">
        {searchTerm && Object.keys(visibleDropdowns).length === 0 ? (
          <EmptyState label="No workflow dropdown values match your search." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(visibleDropdowns).map(([category, values]) => (
              <div
                className="rounded-md border border-brand-border bg-brand-light p-4"
                key={category}
              >
                <div className="mb-2 font-semibold text-sm capitalize">{category}</div>
                <div className="flex flex-wrap gap-2">
                  {values.map((value) => (
                    <Badge key={value} label={value} tone="gray" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
