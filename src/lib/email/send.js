import { Resend } from "resend";
import { AUTH_EMAIL_FROM } from "@/lib/email/config";

const resendKey = process.env.RESEND_API_KEY;

export const resend = resendKey ? new Resend(resendKey) : null;

export async function sendEmail({ to, subject, html, replyTo, from }) {
  if (!resend) {
    throw new Error("Resend API key is not configured.");
  }

  const { data, error } = await resend.emails.send({
    from: from || AUTH_EMAIL_FROM,
    html,
    reply_to: replyTo,
    subject,
    to: Array.isArray(to) ? to : [to],
  });

  if (error) {
    throw error;
  }

  return data;
}
