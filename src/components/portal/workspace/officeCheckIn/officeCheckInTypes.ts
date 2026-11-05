import type { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

export type MyCheckInStatus = FunctionReturnType<typeof api.crm.officeCheckIns.myStatus>;
export type CheckInRecord = NonNullable<MyCheckInStatus["today"]>;
export type VerificationRecord = CheckInRecord["clockIn"];
export type TeamDay = FunctionReturnType<typeof api.crm.officeCheckIns.teamDay>;
export type TeamDayRow = TeamDay["rows"][number];
export type OfficeCheckInOverview = FunctionReturnType<typeof api.crm.officeCheckInAdmin.overview>;
export type OverviewOffice = OfficeCheckInOverview["offices"][number];
export type OfficeRule = NonNullable<OverviewOffice["rule"]>;

export interface OfficeCheckInAccess {
  roles?: string[];
  staffId?: string;
}
