"use node";

import { v } from "convex/values";
import { Resend } from "resend";
import { internalAction } from "./_generated/server";
import { AUTH_EMAIL_FROM } from "./lib/emailConfig";

export const sendEmail = internalAction({
  args: {
    html: v.string(),
    replyTo: v.optional(v.string()),
    subject: v.string(),
    to: v.string(),
  },
  handler: async (_ctx, args) => {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      throw new Error("RESEND_API_KEY environment variable is not configured.");
    }
    const emailFrom = AUTH_EMAIL_FROM;
    const resend = new Resend(resendKey);
    const { error, data } = await resend.emails.send({
      from: emailFrom,
      html: args.html,
      replyTo: args.replyTo,
      subject: args.subject,
      to: [args.to],
    });
    if (error) {
      console.error("Resend send email error:", error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
    return { id: data?.id, success: true };
  },
});
