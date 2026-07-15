import { Resend } from "resend";
import { deliverNotificationEmailsSequentially } from "../../../convex/crm/notificationEmailDelivery";
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

const CONTACT_EMAIL_MAX_RETRIES = 4;
const CONTACT_EMAIL_RETRY_INTERVAL_MS = 550;

export async function deliverContactEmail(input: DeliverContactEmailInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Resend API key is not configured.");
  }

  const resend = new Resend(apiKey);
  const recipients = (Array.isArray(input.to) ? input.to : [input.to])
    .map((recipient) => recipient.trim())
    .filter(Boolean);
  const eventId = await contactEmailEventId(input);
  const result = await deliverNotificationEmailsSequentially({
    config: {
      maxRetries: CONTACT_EMAIL_MAX_RETRIES,
      minIntervalMs: CONTACT_EMAIL_RETRY_INTERVAL_MS,
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
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });

  if (result.sent !== recipients.length) {
    throw new Error("Contact email delivery failed.");
  }
  return { eventId, ...result };
}
