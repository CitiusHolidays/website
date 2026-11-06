"use client";

import { Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PortalTabs } from "@/components/portal/PortalTabs";
import { usePortalToast } from "@/components/portal/PortalToast";
import { QueryRowActions } from "@/components/portal/QueryRowActions";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { OperationalControlsPanel } from "@/components/portal/settings/OperationalControlsPanel";
import { isExactAdmin } from "@/components/portal/settings/operationalControlViewModel";
import type { PortalGridColumn } from "@/lib/portal/portalDataGrid";
import { resolveTabId } from "@/lib/portal/portalTabs";
import { EmptyState, LoadingPanel } from "../portalAdminHelpers";
import { filterDropdowns, onboardingActionLabel } from "../portalAdminUtils";
import type { PortalStaffSettingsRow, SettingsViewProps } from "../portalViewTypes";
import { formatConvexError, strong } from "../portalWorkspaceListHelpers";
import { Badge, Panel } from "../portalWorkspaceListUi";

type StaffRow = PortalStaffSettingsRow;
type BadgeTone = "blue" | "gray" | "green" | "red";

const LazyStaffWorkbookImportPanel = dynamic(
  () =>
    import("@/components/portal/settings/StaffWorkbookImportPanel").then(
      (module) => module.StaffWorkbookImportPanel
    ),
  { loading: () => <LoadingPanel />, ssr: false }
);

const STAFF_TAB = "staff";
const LIVE_CONTROLS_TAB = "live-controls";

function settingsTabs(canUseLiveControls: boolean, staffCount: number) {
  const tabs = [
    { count: staffCount, id: STAFF_TAB, label: "Staff" },
    { id: "dropdowns", label: "Dropdown values" },
    { id: "workbook", label: "Leave workbook" },
  ];
  return canUseLiveControls ? [...tabs, { id: LIVE_CONTROLS_TAB, label: "Live controls" }] : tabs;
}

function onboardingBadge(row: StaffRow): { label: string; tone: BadgeTone } {
  if (row.onboardingStatus === "ready") {
    return { label: "Ready", tone: "green" };
  }
  if (row.onboardingStatus === "pending") {
    return { label: "Pending", tone: "blue" };
  }
  return { label: "Not started", tone: "gray" };
}

/** One status per row: inactive staff cannot sign in, so their onboarding state is secondary. */
function staffStatus(row: StaffRow): { label: string; meaning: string; tone: BadgeTone } {
  if (!row.active) {
    return { label: "Inactive", meaning: "Inactive: cannot sign in", tone: "red" };
  }
  const onboarding = onboardingBadge(row);
  return {
    label: `Active · ${onboarding.label}`,
    meaning: `Active, onboarding ${onboarding.label.toLowerCase()}`,
    tone: onboarding.tone,
  };
}

function StaffRowActions({
  deleteItem,
  openModal,
  removeStaff,
  row,
  startStaffOnboarding,
}: Pick<SettingsViewProps, "deleteItem" | "openModal" | "removeStaff" | "startStaffOnboarding"> & {
  row: StaffRow;
}) {
  const toast = usePortalToast();
  const [isSending, setIsSending] = useState(false);
  const edit = () => {
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
      staffId: String(row.id),
      staffName: row.name,
      staffRoles: row.roles,
    });
  };
  const sendOnboarding = async () => {
    setIsSending(true);
    try {
      const result = await startStaffOnboarding({ staffId: String(row.id) });
      toast.success(result?.message || `Onboarding email sent to ${row.email}.`);
    } catch (err) {
      console.error(err);
      toast.error(formatConvexError(err, "Unable to send the onboarding email. Try again."));
    }
    setIsSending(false);
  };
  const remove = () => {
    deleteItem(row.email, removeStaff, { staffId: String(row.id) });
  };

  return (
    <QueryRowActions
      label={row.name}
      overflowActions={[
        <button disabled={isSending} key="onboarding" onClick={sendOnboarding} type="button">
          {isSending ? "Sending…" : onboardingActionLabel(row)}
        </button>,
        <button
          aria-label={`Delete ${row.email}`}
          className="portal-danger-btn"
          key="delete"
          onClick={remove}
          type="button"
        >
          <Trash2 aria-hidden="true" size={13} />
          Delete
        </button>,
      ]}
      primaryAction={
        <button className="portal-small-btn" onClick={edit} type="button">
          Edit
        </button>
      }
    />
  );
}

type StaffActionProps = Pick<
  SettingsViewProps,
  "deleteItem" | "openModal" | "removeStaff" | "startStaffOnboarding"
>;

function staffActionColumn(actions: StaffActionProps): PortalGridColumn<StaffRow> {
  return {
    id: "action",
    kind: "action",
    label: "Action",
    render: (row) => <StaffRowActions {...actions} row={row} />,
  };
}

/** The everyday view: who someone is, what they can do and whether they can sign in. */
function compactStaffColumns(actions: StaffActionProps): PortalGridColumn<StaffRow>[] {
  return [
    {
      id: "name",
      kind: "identity",
      label: "Name",
      render: (row) => (
        <span className="flex min-w-0 flex-col">
          {strong(row.name)}
          <span className="break-all text-brand-muted text-xs">{row.email}</span>
        </span>
      ),
      sortValue: (row) => row.name,
    },
    {
      id: "roles",
      label: "Roles",
      render: (row) => row.roles.join(", "),
    },
    {
      id: "department",
      label: "Department",
      render: (row) => row.department || "-",
    },
    {
      id: "status",
      kind: "status",
      label: "Status",
      render: (row) => {
        const status = staffStatus(row);
        return <Badge label={status.label} meaning={status.meaning} tone={status.tone} />;
      },
    },
    staffActionColumn(actions),
  ];
}

/** Every stored field, for audits and reporting-line checks. */
function allStaffColumns(actions: StaffActionProps): PortalGridColumn<StaffRow>[] {
  return [
    {
      id: "name",
      kind: "identity",
      label: "Name",
      render: (row) => strong(row.name),
      sortValue: (row) => row.name,
    },
    {
      id: "email",
      label: "Email",
      render: (row) => row.email,
    },
    {
      id: "leave-head-approver",
      label: "Leave head approver",
      render: (row) => row.leaveHeadApproverName || "From leave matrix",
    },
    {
      id: "reporting-manager",
      label: "Reporting manager",
      render: (row) => row.reportingManagerName || "-",
    },
    {
      id: "department",
      label: "Department",
      render: (row) => row.department || "-",
    },
    {
      id: "function",
      label: "Function",
      render: (row) => row.function || "-",
    },
    {
      id: "location",
      label: "Location",
      render: (row) => row.location || "-",
    },
    {
      id: "roles",
      label: "Roles",
      render: (row) => row.roles.join(", "),
    },
    {
      id: "email-alerts",
      label: "Additional email alert roles",
      render: (row) =>
        row.emailAlertRoles && row.emailAlertRoles.length > 0
          ? row.emailAlertRoles.join(", ")
          : "No additional email alert roles",
    },
    {
      id: "onboarding",
      label: "Onboarding",
      render: (row) => {
        const badge = onboardingBadge(row);
        return <Badge label={badge.label} tone={badge.tone} />;
      },
    },
    {
      id: "active",
      kind: "status",
      label: "Active",
      render: (row) => (
        <Badge label={row.active ? "Active" : "Inactive"} tone={row.active ? "green" : "red"} />
      ),
    },
    staffActionColumn(actions),
  ];
}

function StaffTab({
  actions,
  searchTerm,
  staff,
}: {
  actions: StaffActionProps;
  searchTerm: string;
  staff: StaffRow[];
}) {
  const [showAllColumns, setShowAllColumns] = useState(false);
  const toggleColumns = () => setShowAllColumns((current) => !current);
  return (
    <Panel
      action={
        <button
          aria-controls="settings-staff-table"
          className="portal-small-btn min-h-11 shrink-0 md:min-h-9"
          onClick={toggleColumns}
          type="button"
        >
          {showAllColumns ? "Show fewer columns" : "Show all columns"}
        </button>
      }
      subtitle="Who can sign in to Citius Connect, their roles and onboarding."
      title="Staff access"
    >
      <div id="settings-staff-table">
        <SelectableDataTable
          columns={showAllColumns ? allStaffColumns(actions) : compactStaffColumns(actions)}
          compact
          empty={searchTerm ? "No staff match your search." : "No staff records yet."}
          rowLabel={(row: StaffRow) => row.name}
          rows={staff}
        />
      </div>
    </Panel>
  );
}

function DropdownValuesTab({
  dropdowns,
  searchTerm,
}: {
  dropdowns: Record<string, string[]>;
  searchTerm: string;
}) {
  const visibleDropdowns = filterDropdowns(dropdowns, searchTerm);
  return (
    <Panel
      subtitle="The choices staff see in workflow forms. They can't be changed here."
      title="Workflow dropdown values (read-only)"
    >
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
  );
}

function WorkbookTab() {
  const [open, setOpen] = useState(false);
  if (open) {
    return <LazyStaffWorkbookImportPanel onClose={() => setOpen(false)} />;
  }
  return (
    <section className="rounded-lg border border-brand-border bg-white p-5 shadow-sm md:p-6">
      <h2 className="font-heading font-semibold text-citius-blue text-lg md:text-xl">
        Leave matrix workbook
      </h2>
      <p className="mt-1 max-w-2xl text-brand-muted text-sm">
        Upload the leave matrix spreadsheet to preview new or changed staff records and approver
        routing before you apply them.
      </p>
      <button className="portal-primary-btn mt-4" onClick={() => setOpen(true)} type="button">
        Open workbook import
      </button>
    </section>
  );
}

export function SettingsView({
  access,
  staff,
  dropdowns,
  search,
  openModal,
  deleteItem,
  removeStaff,
  startStaffOnboarding,
}: SettingsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canUseLiveControls = isExactAdmin(access);
  const tabs = settingsTabs(canUseLiveControls, staff.length);
  // An unknown tab, or Live controls for anyone but an exact Admin, falls back to Staff.
  const tab = resolveTabId(
    tabs.map((item) => item.id),
    searchParams.get("tab"),
    STAFF_TAB
  );
  const setTab = (nextTab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
  };
  const searchTerm = search.trim();
  const actions = { deleteItem, openModal, removeStaff, startStaffOnboarding };

  return (
    <PortalTabs ariaLabel="Settings sections" items={tabs} onValueChange={setTab} value={tab}>
      {tab === STAFF_TAB ? (
        <StaffTab actions={actions} searchTerm={searchTerm} staff={staff} />
      ) : null}
      {tab === "dropdowns" ? (
        <DropdownValuesTab dropdowns={dropdowns} searchTerm={searchTerm} />
      ) : null}
      {tab === "workbook" ? <WorkbookTab /> : null}
      {tab === LIVE_CONTROLS_TAB && canUseLiveControls ? <OperationalControlsPanel /> : null}
    </PortalTabs>
  );
}
