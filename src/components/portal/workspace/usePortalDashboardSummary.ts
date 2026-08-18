import { api } from "@convex/_generated/api";
import { useTrackedQuery as useQuery } from "@/lib/portal/trackedConvexSubscriptions";
import { propertiesWhen } from "../../../lib/runtimeValues";

export function useDashboardSummary(
  allowed: boolean | undefined,
  canFetch: boolean | undefined,
  dateRange: { from?: string; to?: string } | undefined,
  referenceNow: number,
  shouldLoad: boolean
) {
  const args = canFetch && allowed && shouldLoad ? { dateRange, referenceNow } : "skip";
  const summary = useQuery(api.crm.dashboard.getPortalSummary, args);
  const coverage = useQuery(api.crm.dashboard.getPortalMetricCoverage, args);
  const sectionArgs = args === "skip" ? "skip" : { dateRange };
  const people = useQuery(api.crm.dashboard.getPortalDashboardCapacity, sectionArgs);
  const recentActivity = useQuery(api.crm.dashboard.getPortalDashboardActivity, sectionArgs);
  return summary
    ? {
        ...summary,
        ...propertiesWhen(coverage, () => ({ aggregateCoverage: coverage })),
        ...people,
        ...propertiesWhen(recentActivity, () => ({ recentActivity })),
      }
    : summary;
}
