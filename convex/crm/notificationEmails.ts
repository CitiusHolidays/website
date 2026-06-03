"use node";

import { v } from "convex/values";
import { Resend } from "resend";
import { internalAction } from "../_generated/server";
import { AUTH_EMAIL_FROM } from "../lib/emailConfig";
import { getNotificationHref } from "./notificationPaths";

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
    const html = buildNotificationHtml({
      title: args.title,
      body: args.body,
      href,
    });
    const resend = new Resend(resendKey);
    const outcomes = await Promise.all(
      recipients.map(async (recipient) => {
        const { error } = await resend.emails.send({
          from: AUTH_EMAIL_FROM,
          to: [recipient],
          subject: `Citius Connect: ${args.title}`,
          html,
        });
        if (error) {
          console.error("Failed to send notification email:", error);
          return false;
        }
        return true;
      }),
    );
    const sent = outcomes.filter(Boolean).length;

    return { sent, skipped: recipients.length - sent };
  },
});
