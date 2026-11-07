import { cronJobs, makeFunctionReference } from "convex/server";

const crons = cronJobs();
const scheduledJob = (name: string) =>
  makeFunctionReference<"action", Record<string, never>, { executed: boolean }>(name);

crons.cron(
  "check cl-sl leave lapse",
  "30 18 * * *",
  scheduledJob("operationalScheduledJobs:checkClSlLeaveLapse"),
  {}
);

crons.cron(
  "run portal workflow nudges",
  "30 3 * * *",
  scheduledJob("operationalScheduledJobs:runWorkflowNudges"),
  {}
);

crons.cron(
  "clean expired ai runtime data",
  "15 2 * * *",
  scheduledJob("operationalScheduledJobs:cleanupAiRuntime"),
  {}
);

crons.interval(
  "clean expired portal rate limits",
  { hours: 1 },
  scheduledJob("operationalScheduledJobs:cleanupPortalRateLimits"),
  {}
);

crons.interval(
  "clean expired sacred bharat rate limits",
  { hours: 1 },
  scheduledJob("operationalScheduledJobs:cleanupSacredBharatRateLimits"),
  {}
);

crons.interval(
  "clean expired passenger exports",
  { minutes: 15 },
  scheduledJob("operationalScheduledJobs:cleanupPassengerExports"),
  {}
);

crons.interval(
  "reconcile bounded crm metrics",
  { minutes: 15 },
  scheduledJob("operationalScheduledJobs:reconcileCrmMetrics"),
  {}
);

crons.interval(
  "reconcile crm list search text",
  { hours: 1 },
  scheduledJob("operationalScheduledJobs:reconcileListSearch"),
  {}
);

crons.interval(
  "reconcile proposal link projections",
  { hours: 1 },
  scheduledJob("operationalScheduledJobs:reconcileProposalLinks"),
  {}
);

crons.interval(
  "reconcile proposal relation summaries",
  { hours: 1 },
  scheduledJob("operationalScheduledJobs:reconcileProposalRelations"),
  {}
);

crons.interval(
  "reconcile query commercial projections",
  { hours: 1 },
  scheduledJob("operationalScheduledJobs:reconcileQueryCommercial"),
  {}
);

// Issues GST invoices that were waiting for the company's invoice configuration,
// so the Billing policy's 48-hour invoice promise holds without an operator. It
// returns immediately while the configuration is incomplete.
crons.interval(
  "issue pending booking invoices",
  { hours: 1 },
  scheduledJob("operationalScheduledJobs:issuePendingBookingInvoices"),
  {}
);

crons.cron(
  "purge expired commercial files",
  "15 4 * * *",
  scheduledJob("operationalScheduledJobs:purgeCommercialFiles"),
  {}
);

// 20:15 UTC is 01:45 IST: customer app sign-in requests older than a day.
crons.cron(
  "purge customer app sign-in requests",
  "15 20 * * *",
  scheduledJob("operationalScheduledJobs:purgeCustomerAppSignInLinks"),
  {}
);

// 19:00 UTC is 00:30 IST, just after a field passport window closes at 24:00 IST.
crons.cron(
  "purge field passport audit after trips",
  "0 19 * * *",
  scheduledJob("operationalScheduledJobs:purgeFieldPassportAudit"),
  {}
);

// 21:00 UTC is 02:30 in the office default time zone (Asia/Kolkata).
crons.cron(
  "purge expired office check-ins",
  "0 21 * * *",
  scheduledJob("operationalScheduledJobs:purgeOfficeCheckIns"),
  {}
);

// Data retention schedule (crm/retention/*). Each job is off until the owner switches it on.
// 19:15 UTC is 00:45 IST, after the IST date changes.
crons.cron(
  "purge passport scans after trips",
  "15 19 * * *",
  scheduledJob("operationalScheduledJobs:purgePassportScans"),
  {}
);

// 21:30 UTC is 03:00 IST.
crons.cron(
  "purge activity logs after a year",
  "30 21 * * *",
  scheduledJob("operationalScheduledJobs:purgeActivityLogs"),
  {}
);

// 21:45 UTC is 03:15 IST.
crons.cron(
  "purge unconverted enquiries",
  "45 21 * * *",
  scheduledJob("operationalScheduledJobs:purgeUnconvertedEnquiries"),
  {}
);

// The multi-year rules run weekly, on Sunday nights UTC (early Monday IST).
crons.cron(
  "purge old traveller feedback",
  "0 22 * * 0",
  scheduledJob("operationalScheduledJobs:purgeOldFeedback"),
  {}
);

crons.cron(
  "anonymise past travellers",
  "15 22 * * 0",
  scheduledJob("operationalScheduledJobs:anonymisePastTravellers"),
  {}
);

crons.cron(
  "retire old bookings and invoices",
  "30 22 * * 0",
  scheduledJob("operationalScheduledJobs:retireFinancialRecords"),
  {}
);

crons.cron(
  "purge inactive customer accounts",
  "45 22 * * 0",
  scheduledJob("operationalScheduledJobs:purgeInactiveCustomerAccounts"),
  {}
);

export default crons;
