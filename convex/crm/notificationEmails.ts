"use node";

import { v } from "convex/values";
import { Resend } from "resend";
import { internalAction } from "../_generated/server";
import { AUTH_EMAIL_FROM } from "../lib/emailConfig";

function siteUrl() {
  return (
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function notificationPath(args: { entityType?: string; entityId?: string; title: string }) {
  if (!args.entityType || !args.entityId) {
    return "/portal/activity";
  }

  const params = new URLSearchParams();

  switch (args.entityType) {
    case "query":
      if (args.title === "Order confirmed") {
        params.set("open", "jobCard");
        params.set("queryId", args.entityId);
        return `/portal/accounts/job-cards?${params}`;
      }
      if (args.title === "Order confirmed — assign owners") {
        return "/portal/job-cards";
      }
      if (args.title === "New query received" || args.title === "Query submitted to Contracting") {
        params.set("open", "queryStatus");
        params.set("id", args.entityId);
        return `/portal/contracting?${params}`;
      }
      params.set("open", "query");
      params.set("id", args.entityId);
      return `/portal/queries?${params}`;
    case "proposal":
      params.set("open", "proposal");
      params.set("id", args.entityId);
      return `/portal/proposals?${params}`;
    case "jobCard":
      if (args.title === "Assign contracting SPOC" || args.title === "Assign contracting owner") {
        params.set("open", "assignContractingOwner");
      } else if (args.title === "Assign operations owner") {
        params.set("open", "assignOperationsOwner");
      } else if (args.title === "Assign ticketing owner") {
        params.set("open", "assignTicketingOwner");
      } else {
        params.set("open", "jobCard");
      }
      params.set("id", args.entityId);
      return `/portal/job-cards?${params}`;
    case "ticket":
      params.set("open", "ticket");
      params.set("id", args.entityId);
      return `/portal/tickets?${params}`;
    case "leave":
      params.set("open", "leave_create");
      params.set("id", args.entityId);
      return `/portal/employees-on-leave?${params}`;
    case "approval":
      params.set("open", "approval");
      params.set("id", args.entityId);
      return `/portal/approvals?${params}`;
    default:
      return "/portal/activity";
  }
}

function buildNotificationHtml(args: { title: string; body: string; href: string }) {
  const title = escapeHtml(args.title);
  const body = escapeHtml(args.body);
  const href = escapeHtml(args.href);

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f6f8fb;font-family:Arial,sans-serif;color:#14213d;">
    <div style="margin:0 auto;max-width:560px;padding:32px 20px;">
      <div style="border:1px solid #dfe5ef;border-radius:12px;background:#ffffff;padding:24px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0f4c81;">Citius Connect</p>
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#102a83;">${title}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">${body}</p>
        <a href="${href}" style="display:inline-block;border-radius:999px;background:#f58220;padding:12px 18px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Open in portal</a>
        <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#6b7280;">This email mirrors an in-app notification in Citius Connect.</p>
      </div>
    </div>
  </body>
</html>`;
}

export const sendNotificationEmail = internalAction({
  args: {
    recipients: v.array(v.string()),
    title: v.string(),
    body: v.string(),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      console.error("Skipping notification email: RESEND_API_KEY is not configured.");
      return { sent: 0, skipped: args.recipients.length };
    }

    const recipients = Array.from(
      new Set(args.recipients.map((email) => email.trim().toLowerCase()).filter(Boolean)),
    );
    if (recipients.length === 0) {
      return { sent: 0, skipped: 0 };
    }

    const href = `${siteUrl()}${notificationPath(args)}`;
    const html = buildNotificationHtml({
      title: args.title,
      body: args.body,
      href,
    });
    const resend = new Resend(resendKey);
    let sent = 0;

    for (const recipient of recipients) {
      const { error } = await resend.emails.send({
        from: AUTH_EMAIL_FROM,
        to: [recipient],
        subject: `Citius Connect: ${args.title}`,
        html,
      });
      if (error) {
        console.error("Failed to send notification email:", error);
        continue;
      }
      sent += 1;
    }

    return { sent, skipped: recipients.length - sent };
  },
});
