import { isRuntimeObject, isRuntimeString } from "../lib/runtimeValues";
import type {
  NotificationEmailSendMessage,
  NotificationEmailSendOptions,
} from "./notificationEmailDelivery";

export async function sendNotificationEmailWithResend(
  apiKey: string,
  message: NotificationEmailSendMessage,
  options: NotificationEmailSendOptions,
  request: typeof fetch = fetch
) {
  const response = await request("https://api.resend.com/emails", {
    body: JSON.stringify({
      from: message.from,
      html: message.html,
      reply_to: message.replyTo,
      subject: message.subject,
      text: message.text,
      to: message.to,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": options.idempotencyKey,
    },
    method: "POST",
    signal: options.signal,
  });
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      error: { name: "invalid_provider_response", statusCode: response.ok ? 502 : response.status },
    };
  }
  if (!response.ok) {
    const name =
      isRuntimeObject(payload) && "name" in payload && isRuntimeString(payload.name)
        ? payload.name
        : "provider_rejected";
    return { error: { name, statusCode: response.status } };
  }
  if (
    !(
      isRuntimeObject(payload) &&
      "id" in payload &&
      isRuntimeString(payload.id) &&
      payload.id.trim()
    )
  ) {
    return { error: { name: "invalid_provider_response", statusCode: 502 } };
  }
  return { data: { id: payload.id }, error: null };
}
