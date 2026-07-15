#!/usr/bin/env bun
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";

const COMMON_HEADER = `"use client";

import { formatDate } from "@/components/portal/PortalModalForm";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { formatDisplayDate } from "@/lib/formatDate";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { getJobCardAttention } from "@/lib/portal/jobCardListPresentation";
import {
  canAssignContracting,
  canAssignOperations,
  canAssignTicketing,
} from "@/lib/portal/permissions";
`;

const FILE_CONFIG: Record<string, { extraImports: string; propsType: string; rename?: string }> = {
  HotelRoomingTabs: {
    extraImports: `import { useRouter, useSearchParams } from "next/navigation";
import { PortalTabs } from "@/components/portal/PortalTabs";
import { resolveTabId } from "@/lib/portal/portalTabs";
import type { HotelRoomingViewProps } from "../portalViewTypes";
import { HOTEL_ROOMING_TABS } from "../portalOperationsHelpers";
import { Panel } from "../portalWorkspaceListUi";
import { HotelsView } from "./HotelsView";
import { JobCardFilterPanel } from "./JobCardFilterPanel";
import { RoomCountView } from "./RoomCountView";
import { RoomingListView } from "./RoomingListView";
`,
    propsType: "HotelRoomingViewProps",
    rename: "HotelRoomingView",
  },
  HotelsView: {
    extraImports: `import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { formatDisplayDate } from "@/lib/formatDate";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import type { PortalHotelListRow, PortalBulkDeleteHandler, PortalDeleteHandler, PortalModalOpener, PortalPermissionChecker } from "../portalViewTypes";
import { DeleteButton, EditButton } from "../portalWorkspaceListUi";
import { strong } from "../portalWorkspaceListHelpers";

export interface HotelsViewProps {
  deleteItem: PortalDeleteHandler;
  deleteSelected: PortalBulkDeleteHandler;
  filtersActive?: boolean;
  has: PortalPermissionChecker;
  openModal: PortalModalOpener;
  removeHotel: (args: { hotelId?: string }) => Promise<unknown>;
  removeManyHotels: (args: { hotelIds: string[] }) => Promise<unknown>;
  rows: PortalHotelListRow[];
}
`,
    propsType: "HotelsViewProps",
  },
  JobCardsView: {
    extraImports: `import type { JobCardsViewProps } from "../portalViewTypes";
import { Badge } from "../portalWorkspaceListUi";
import { statusTone, strong } from "../portalWorkspaceListHelpers";
import { JobCardRowActions } from "./JobCardRowActions";
import { JobCardTravelBatchesCell } from "./JobCardTravelBatchesCell";
`,
    propsType: "JobCardsViewProps",
  },
  PassportDocumentsView: {
    extraImports: `import { Loader2 } from "lucide-react";
import { usePortalConfirm } from "@/components/portal/PortalConfirmDialog";
import { usePortalToast } from "@/components/portal/PortalToast";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { runMutation } from "@/lib/portal/runMutation";
import { usePatchReducer } from "@/lib/portal/patchReducer";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import type { PassportDocumentsViewProps } from "../portalViewTypes";
import { inferPassportMimeType, travelBatchDisplayLabel } from "../portalOperationsHelpers";
import {
  Badge,
  DeleteButton,
} from "../portalWorkspaceListUi";
import { formatConvexError, openPortalFile, strong } from "../portalWorkspaceListHelpers";
import { PassportUploadModal } from "./PassportUploadModal";
`,
    propsType: "PassportDocumentsViewProps",
  },
  PassportUploadModal: {
    extraImports: `import { Loader2 } from "lucide-react";
import { PortalDateInput } from "@/components/portal/PortalDateInput";
import { PORTAL_Z } from "@/lib/portal/zIndex";
import type { PortalPassportTravellerRow } from "../portalViewTypes";

export interface PassportUploadModalProps {
  isUploading: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  passportForm: {
    dateOfBirth: string;
    expiryDate: string;
    nationality: string;
    number: string;
  };
  setPassportForm: (
    value:
      | PassportUploadModalProps["passportForm"]
      | ((current: PassportUploadModalProps["passportForm"]) => PassportUploadModalProps["passportForm"])
  ) => void;
  uploadError: string;
  uploadTraveller: PortalPassportTravellerRow | null;
}
`,
    propsType: "PassportUploadModalProps",
    rename: "PassportUploadModal",
  },
  RoomCountView: {
    extraImports: `import type { PortalJobCardOption, PortalPaginationSlice, PortalRoomCountSummary } from "../portalViewTypes";
import { estimateRoomCount } from "../portalOperationsHelpers";
import { Badge, DashboardSectionHeading, Panel } from "../portalWorkspaceListUi";
import { strong } from "../portalWorkspaceListHelpers";
import { JobCardFilterPanel } from "./JobCardFilterPanel";

export interface RoomCountViewProps {
  jobCardFilter: string;
  jobCards: PortalJobCardOption[];
  pagination?: PortalPaginationSlice;
  setJobCardFilter: (value: string) => void;
  summary?: PortalRoomCountSummary;
}
`,
    propsType: "RoomCountViewProps",
  },
  RoomingListView: {
    extraImports: `import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import type { PortalBulkDeleteHandler, PortalDeleteHandler, PortalPermissionChecker, PortalTravellerListRow } from "../portalViewTypes";
import { travelBatchDisplayLabel } from "../portalOperationsHelpers";
import { Badge, DeleteButton } from "../portalWorkspaceListUi";
import { statusTone, strong } from "../portalWorkspaceListHelpers";

export interface RoomingListViewProps {
  deleteItem: PortalDeleteHandler;
  deleteSelected: PortalBulkDeleteHandler;
  filtersActive?: boolean;
  has: PortalPermissionChecker;
  removeManyTravellers: (args: { travellerIds: string[] }) => Promise<unknown>;
  removeTraveller: (args: { travellerId?: string }) => Promise<unknown>;
  rows: PortalTravellerListRow[];
}
`,
    propsType: "RoomingListViewProps",
  },
  TourManagersView: {
    extraImports: `import { CheckCircle2, ShieldCheck, Users } from "lucide-react";
import { CALLING_STATUSES, PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { runMutation } from "@/lib/portal/runMutation";
import { usePortalToast } from "@/components/portal/PortalToast";
import type { TourManagersViewProps } from "../portalViewTypes";
import {
  buildTourManagersByJobAndBatch,
  getAssignedTourManagerNames,
  travelBatchDisplayLabel,
} from "../portalOperationsHelpers";
import {
  Badge,
  DeleteButton,
  EditButton,
  Panel,
  StatCard,
} from "../portalWorkspaceListUi";
import { statusTone, strong } from "../portalWorkspaceListHelpers";
`,
    propsType: "TourManagersViewProps",
  },
  TravellerCountView: {
    extraImports: `import { buildTravellerCountSummary } from "@/lib/portal/travellerSummary";
import type { PortalJobCardOption, PortalTravellerListRow } from "../portalViewTypes";
import { Badge, DashboardSectionHeading, Panel } from "../portalWorkspaceListUi";
import { strong } from "../portalWorkspaceListHelpers";
import { JobCardFilterPanel } from "./JobCardFilterPanel";

export interface TravellerCountViewProps {
  jobCardFilter: string;
  jobCards: PortalJobCardOption[];
  rows: PortalTravellerListRow[];
  setJobCardFilter: (value: string) => void;
}
`,
    propsType: "TravellerCountViewProps",
  },
  TravellersView: {
    extraImports: `import {
  formatPassportExpiryLabel,
  getPassportExpiryInfo,
  passportExpiryTone,
} from "@/lib/portal/passportExpiry";
import type { TravellersViewProps } from "../portalViewTypes";
import { passportRowAttention, travelBatchDisplayLabel } from "../portalOperationsHelpers";
import { Badge, DeleteButton, EditButton } from "../portalWorkspaceListUi";
import { statusTone, strong } from "../portalWorkspaceListHelpers";
import { TravellerCountView } from "./TravellerCountView";
`,
    propsType: "TravellersViewProps",
  },
  VisaTrackingView: {
    extraImports: `import type { VisaTrackingViewProps } from "../portalViewTypes";
import { travelBatchDisplayLabel } from "../portalOperationsHelpers";
import { Badge, DeleteButton } from "../portalWorkspaceListUi";
import { statusTone, strong } from "../portalWorkspaceListHelpers";
`,
    propsType: "VisaTrackingViewProps",
  },
};

function transformBody(body: string, propsType: string) {
  return body
    .replace(/\}: any\) \{/g, `}: ${propsType}) {`)
    .replace(/useTypedPortalToast\(\)/g, "usePortalToast()")
    .replace(/useTypedPortalConfirm\(\)/g, "usePortalConfirm()");
}

for (const [name, config] of Object.entries(FILE_CONFIG)) {
  const extractedPath = `src/components/portal/workspace/operations/_extracted_${name}.txt`;
  let body = readFileSync(extractedPath, "utf8");
  const exportName = config.rename || name;
  if (name === "HotelRoomingTabs") {
    body = body.replace(/function HotelRoomingTabs/, "export function HotelRoomingView");
  } else {
    body = body.replace(new RegExp(`^function ${name}`), `export function ${exportName}`);
  }
  if (name === "TravellerCountView") {
    body = `${body}\n\nfunction buildJobTravellerCountRows(rows: TravellerCountViewProps["rows"], jobCards: PortalJobCardOption[]) {
  const jobsById = new Map(jobCards.map((job) => [job.id, job]));
  const groups = new Map<string, { clientName: string; id: string; jobCode: string; rows: PortalTravellerListRow[] }>();
  for (const row of rows || []) {
    const id = row.jobCardId || "unassigned";
    const current = groups.get(id) || {
      clientName: row.clientName || jobsById.get(row.jobCardId || "")?.clientName || "-",
      id,
      jobCode: row.jobCode || jobsById.get(row.jobCardId || "")?.jobCode || "Unassigned",
      rows: [],
    };
    current.rows.push(row);
    groups.set(id, current);
  }
  return Array.from(groups.values())
    .map((group) => {
      const summary = buildTravellerCountSummary(group.rows);
      const foodParts: string[] = [];
      for (const row of summary.foodRows) {
        if (row.value > 0) {
          foodParts.push(\`\${row.label}: \${row.value}\`);
        }
      }
      return {
        ...group,
        female: summary.female,
        foodBreakdown: foodParts.join(", ") || "-",
        male: summary.male,
        totalPax: group.rows.length,
      };
    })
    .sort((a, b) => a.jobCode.localeCompare(b.jobCode));
}`;
  }
  body = transformBody(body, config.propsType);
  const header =
    name === "HotelsView" ||
    name === "RoomCountView" ||
    name === "TravellerCountView" ||
    name === "RoomingListView"
      ? `"use client";\n\n${config.extraImports}`
      : `${COMMON_HEADER}${config.extraImports}`;
  const outPath = `src/components/portal/workspace/operations/${exportName}.tsx`;
  writeFileSync(outPath, `${header}\n${body}\n`);
  unlinkSync(extractedPath);
  console.log("wrote", outPath);
}
