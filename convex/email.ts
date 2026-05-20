"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { Resend } from "resend";
import { AUTH_EMAIL_FROM } from "./lib/emailConfig";

export const sendEmail = action({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    replyTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      throw new Error("RESEND_API_KEY environment variable is not configured.");
    }
    const emailFrom = AUTH_EMAIL_FROM;
    const resend = new Resend(resendKey);
    const { error, data } = await resend.emails.send({
      from: emailFrom,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      replyTo: args.replyTo,
    });
    if (error) {
      console.error("Resend send email error:", error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
    return { success: true, id: data?.id };
  },
});
