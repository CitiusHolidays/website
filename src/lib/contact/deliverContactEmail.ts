import { Resend } from "resend";
import {
  deliverNotificationEmailsSequentially,
  RESEND_DELIVERY_MAX_ATTEMPTS,
  RESEND_DELIVERY_MIN_INTERVAL_MS,
} from "../../../convex/crm/notificationEmailDelivery";
import { contactEmailEventId, contactEmailText } from "./contactEmailContent";

interface DeliverContactEmailInput {
  email: string;
  formLoadedAt?: number | string | null;
  from: string;
  html: string;
  message: string;
  name: string;
  phone?: string;
  subject: string;
  to: string | string[];
}

export async function deliverContactEmail(input: DeliverContactEmailInput) {
  // Keep the legacy key usable during the documented Resend environment
  // migration. RESEND_API_KEY remains the canonical name and wins when both
  // values are present.
  const apiKey = (process.env.RESEND_API_KEY || process.env.RESEND_KEY)?.trim();
  if (!apiKey) {
    throw new Error("Resend API key is not configured.");
  }

  const resend = new Resend(apiKey);
  const recipients = (Array.isArray(input.to) ? input.to : [input.to]).flatMap((recipient) => {
    const trimmed = recipient.trim();
    return trimmed ? [trimmed] : [];
  });
  const eventId = await contactEmailEventId(input);
  const result = await deliverNotificationEmailsSequentially({
    config: {
      maxAttempts: RESEND_DELIVERY_MAX_ATTEMPTS,
      minIntervalMs: RESEND_DELIVERY_MIN_INTERVAL_MS,
    },
    eventId,
    idempotencyNamespace: "contact-form",
    message: {
      from: input.from,
      html: input.html,
      replyTo: input.email,
      subject: `Contact Form Submission: ${input.subject}`,
      text: contactEmailText(input),
    },
    recipients,
    sendEmail: async (message, options) => {
      const { error } = await resend.emails.send(
        {
          from: message.from,
          html: message.html,
          replyTo: message.replyTo,
          subject: message.subject,
          text: message.text,
          to: message.to,
        },
        options
      );
      return { error };
    },
  });

  if (result.sent !== recipients.length) {
    throw new Error("Contact email delivery failed.");
  }
  return { eventId, ...result };
}
