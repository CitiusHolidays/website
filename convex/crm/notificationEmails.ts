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
  },
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

function buildDetailsHtml(details: EmailDetails) {
  if (!details || details.rows.length === 0) {
    return "";
  }

  const rows = details.rows
    .map(
      (row) => `<tr>
          <td style="padding:9px 12px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;line-height:1.4;width:38%;vertical-align:top;">${escapeHtml(row.label)}</td>
          <td style="padding:9px 12px;border-top:1px solid #e5e7eb;color:#111827;font-size:13px;line-height:1.4;font-weight:600;vertical-align:top;">${escapeHtml(row.value)}</td>
        </tr>`,
    )
    .join("");

  return `<div style="margin:0 0 24px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;background:#fbfdff;">
          <p style="margin:0;padding:11px 12px;background:#f3f6fb;color:#0f4c81;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">${escapeHtml(details.title)}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
            ${rows}
          </table>
        </div>`;
}

function buildNotificationText(args: {
  title: string;
  body: string;
  href: string;
  details: EmailDetails;
}) {
  const detailLines =
    args.details && args.details.rows.length > 0
      ? ["", args.details.title, ...args.details.rows.map((row) => `${row.label}: ${row.value}`)]
      : [];

  return [args.title, "", args.body, ...detailLines, "", `Open in portal: ${args.href}`].join("\n");
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

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f6f8fb;font-family:Arial,sans-serif;color:#14213d;">
    <div style="margin:0 auto;max-width:560px;padding:32px 20px;">
      <div style="border:1px solid #dfe5ef;border-radius:12px;background:#ffffff;padding:24px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0f4c81;">Citius Connect</p>
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#102a83;">${title}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">${body}</p>
        ${detailsHtml}
        <a href="${href}" style="display:inline-block;border-radius:999px;background:#f58220;padding:12px 18px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Open in portal</a>
        <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#6b7280;">This email mirrors an in-app notification in Citius Connect.</p>
      </div>
    </div>
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
  sent = 0,
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
    sent + (delivered ? 1 : 0),
  );
}

export const sendNotificationEmail = internalAction({
  args: {
    recipients: v.array(v.string()),
    title: v.string(),
    body: v.string(),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
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
        }),
      ),
    );
    if (recipients.length === 0) {
      return { sent: 0, skipped: 0 };
    }

    const href = `${siteUrl()}${getNotificationHref(args)}`;
    const details: EmailDetails =
      args.entityType && args.entityId
        ? await ctx.runQuery(internal.crm.notificationEmailDetails.getNotificationEmailDetails, {
            entityType: args.entityType,
            entityId: args.entityId,
          })
        : null;
    const html = buildNotificationHtml({
      title: args.title,
      body: args.body,
      href,
      details,
    });
    const text = buildNotificationText({
      title: args.title,
      body: args.body,
      href,
      details,
    });
    const resend = new Resend(resendKey);
    const sent = await sendNotificationEmailsSequentially(resend, recipients, {
      from: AUTH_EMAIL_FROM,
      subject: `Citius Connect: ${args.title}`,
      html,
      text,
    });

    return { sent, skipped: recipients.length - sent };
  },
});
