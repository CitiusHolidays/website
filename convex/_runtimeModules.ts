/**
 * Side-effect imports linking every Convex module for static reachability analysis.
 * Imported from convex/http.ts (Convex deploy entry) — not from the Next.js app graph,
 * because Convex API exports are invoked via generated references, not direct imports.
 */
import "./auth";
import "./authSync";
import "./bookings";
import "./migrations";
import "./sacredBharat";
import "./betterAuth/_generated/api";
import "./betterAuth/_generated/component";
import "./betterAuth/_generated/dataModel";
import "./betterAuth/_generated/server";
import schema from "./schema";
import "./trips";
import "./userProfiles";
import "./betterAuth/adapter";
import "./betterAuth/auth";
import "./crm/activity";
import "./crm/approvals";
import "./crm/dashboard";
import "./crm/expenseAttachments";
import "./crm/finance";
import "./crm/imports";
import "./crm/jobCards";
import "./crm/leave";
import "./crm/lib";
import "./crm/navShortcuts";
import "./crm/notificationEmailDetails";
import "./crm/notificationEmails";
import "./crm/ops";
import "./crm/passport";
import "./crm/proposalAttachments";
import "./crm/proposals";
import "./crm/queries";
import "./crm/queryAttachments";
import "./crm/reports";
import "./crm/settings";
import "./crm/staff";
import "./crm/staffImport";
import "./crm/ticketing";
import "./crm/travellers";
import "./crm/visa";
import "./lib/authSync";
import "./lib/emailConfig";
import "./lib/sacredBharatScoring";

void schema;
