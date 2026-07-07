"use node";

import { v } from "convex/values";
import { Resend } from "resend";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { AUTH_EMAIL_FROM } from "../lib/emailConfig";
import { getNotificationHref } from "./notificationPaths";

type EmailDetails = {
  title: string;
  rows: Array<{ label: string; value: string }>;
} | null;

const RESEND_MIN_INTERVAL_MS = 550;
const RESEND_MAX_RETRIES = 4;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: { statusCode?: number | null; name?: string }) {
  return error.statusCode === 429 || error.name === "rate_limit_exceeded";
}

async function sendEmailWithRetry(
  resend: Resend,
  message: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    text: string;
  }
) {
  for (let attempt = 0; attempt < RESEND_MAX_RETRIES; attempt += 1) {
    const { error } = await resend.emails.send(message);
    if (!error) {
      return true;
    }
    if (isRateLimitError(error) && attempt < RESEND_MAX_RETRIES - 1) {
      await sleep(RESEND_MIN_INTERVAL_MS * (attempt + 1));
      continue;
    }
    console.error("Failed to send notification email:", error);
    return false;
  }
  return false;
}

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

const MULTILINE_DETAIL_LABELS = new Set([
  "Batching notes",
  "Decision note",
  "Itinerary summary",
  "Notes",
  "Particulars",
  "Reason",
  "Reporting instructions",
  "Special instructions",
  "Summary",
]);

const EMAIL_NAVY = "#0f2d5c";
const EMAIL_ORANGE = "#f58220";
const EMAIL_BG = "#eef2f7";
const EMAIL_BORDER = "#d5dde8";
const EMAIL_LABEL = "#5c6b7f";
const EMAIL_TEXT = "#1a2332";
const EMAIL_MUTED = "#6b7c93";

function isMultilineDetailRow(label: string, value: string) {
  return value.includes("\n") || MULTILINE_DETAIL_LABELS.has(label);
}

function buildDetailValueHtml(label: string, value: string) {
  const escaped = escapeHtml(value);
  if (isMultilineDetailRow(label, value)) {
    return `<td style="padding:10px 14px;border-top:1px solid ${EMAIL_BORDER};color:${EMAIL_TEXT};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;vertical-align:top;white-space:pre-wrap;word-break:break-word;">${escaped}</td>`;
  }
  return `<td style="padding:10px 14px;border-top:1px solid ${EMAIL_BORDER};color:${EMAIL_TEXT};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;font-weight:600;vertical-align:top;word-break:break-word;">${escaped}</td>`;
}

function buildDetailsHtml(details: EmailDetails) {
  if (!details || details.rows.length === 0) {
    return "";
  }

  const rows = details.rows
    .map(
      (row) => `<tr>
            <td style="padding:10px 14px;border-top:1px solid ${EMAIL_BORDER};color:${EMAIL_LABEL};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.45;width:34%;vertical-align:top;font-weight:600;">${escapeHtml(row.label)}</td>
            ${buildDetailValueHtml(row.label, row.value)}
          </tr>`
    )
    .join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;border-collapse:collapse;border:1px solid ${EMAIL_BORDER};background-color:#f8fafc;">
          <tr>
            <td colspan="2" style="padding:12px 14px;background-color:${EMAIL_NAVY};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(details.title)}</td>
          </tr>
          ${rows}
        </table>`;
}

function buildNotificationText(args: {
  title: string;
  body: string;
  href: string;
  details: EmailDetails;
}) {
  const detailLines =
    args.details && args.details.rows.length > 0
      ? [
          "",
          args.details.title.toUpperCase(),
          "-".repeat(Math.min(args.details.title.length, 48)),
          ...args.details.rows.map((row) => `${row.label}: ${row.value}`),
        ]
      : [];

  return [
    "CITIUS CONNECT",
    args.title,
    "",
    args.body,
    ...detailLines,
    "",
    "Open in portal:",
    args.href,
    "",
    "This email mirrors an in-app notification in Citius Connect.",
  ].join("\n");
}

function buildNotificationHtml(args: {
  title: string;
  body: string;
  href: string;
  details: EmailDetails;
}) {
  const title = escapeHtml(args.title);
  const body = escapeHtml(args.body);
  const href = escapeHtml(args.href);
  const detailsHtml = buildDetailsHtml(args.details);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${EMAIL_BG};font-family:Arial,Helvetica,sans-serif;color:${EMAIL_TEXT};">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${EMAIL_BG};border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:28px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;border-collapse:collapse;">
            <tr>
              <td style="padding:20px 24px;background-color:${EMAIL_NAVY};border:1px solid ${EMAIL_NAVY};border-bottom:none;border-radius:8px 8px 0 0;">
                <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9eb6d4;">Citius Connect</p>
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;color:#d7e3f2;">Portal notification</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px;background-color:#ffffff;border-left:1px solid ${EMAIL_BORDER};border-right:1px solid ${EMAIL_BORDER};">
                <h1 style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.3;font-weight:700;color:${EMAIL_NAVY};">${title}</h1>
                <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#334155;">${body}</p>
                ${detailsHtml}
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td align="left" bgcolor="${EMAIL_ORANGE}" style="border-radius:6px;background-color:${EMAIL_ORANGE};">
                      <a href="${href}" style="display:inline-block;padding:13px 22px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:6px;">Open in portal</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:22px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.55;color:${EMAIL_MUTED};">This email mirrors an in-app notification in Citius Connect. Sign in to review the full record and take action.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;background-color:#f4f7fb;border:1px solid ${EMAIL_BORDER};border-top:none;border-radius:0 0 8px 8px;text-align:center;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:${EMAIL_MUTED};">Citius Connect CRM portal</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendNotificationEmailsSequentially(
  resend: Resend,
  recipients: string[],
  message: {
    from: string;
    subject: string;
    html: string;
    text: string;
  },
  index = 0,
  sent = 0
): Promise<number> {
  if (index >= recipients.length) {
    return sent;
  }

  const delivered = await sendEmailWithRetry(resend, {
    ...message,
    to: [recipients[index]],
  });
  if (recipients.length > 1 && index < recipients.length - 1) {
    await sleep(RESEND_MIN_INTERVAL_MS);
  }

  return sendNotificationEmailsSequentially(
    resend,
    recipients,
    message,
    index + 1,
    sent + (delivered ? 1 : 0)
  );
}

export const sendNotificationEmail = internalAction({
  args: {
    body: v.string(),
    entityId: v.optional(v.string()),
    entityType: v.optional(v.string()),
    recipients: v.array(v.string()),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      console.error("Skipping notification email: RESEND_API_KEY is not configured.");
      return { sent: 0, skipped: args.recipients.length };
    }

    const recipients = Array.from(
      new Set(
        args.recipients.flatMap((email) => {
          const normalized = email.trim().toLowerCase();
          return normalized ? [normalized] : [];
        })
      )
    );
    if (recipients.length === 0) {
      return { sent: 0, skipped: 0 };
    }

    const href = `${siteUrl()}${getNotificationHref(args)}`;
    const details: EmailDetails =
      args.entityType && args.entityId
        ? await ctx.runQuery(internal.crm.notificationEmailDetails.getNotificationEmailDetails, {
            entityId: args.entityId,
            entityType: args.entityType,
          })
        : null;
    const html = buildNotificationHtml({
      body: args.body,
      details,
      href,
      title: args.title,
    });
    const text = buildNotificationText({
      body: args.body,
      details,
      href,
      title: args.title,
    });
    const resend = new Resend(resendKey);
    const sent = await sendNotificationEmailsSequentially(resend, recipients, {
      from: AUTH_EMAIL_FROM,
      html,
      subject: `Citius Connect: ${args.title}`,
      text,
    });

    return { sent, skipped: recipients.length - sent };
  },
});
