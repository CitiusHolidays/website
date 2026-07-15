interface ContactEmailFields {
  email: string;
  formLoadedAt?: number | string | null;
  message: string;
  name: string;
  phone?: string;
  subject: string;
}

function normalizeEventPart(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\r\n/g, "\n");
}

export function contactEmailText(fields: ContactEmailFields) {
  return [
    "New Contact Form Submission",
    "",
    `Name: ${fields.name}`,
    `Email: ${fields.email}`,
    ...(fields.phone ? [`Phone: ${fields.phone}`] : []),
    `Subject: ${fields.subject}`,
    "",
    "Message:",
    fields.message,
    "",
    "This message was submitted through the Citius Holidays website contact form.",
  ].join("\n");
}

export async function contactEmailEventId(fields: ContactEmailFields) {
  const identity = [
    fields.formLoadedAt,
    fields.name,
    fields.email.toLowerCase(),
    fields.phone,
    fields.subject,
    fields.message,
  ]
    .map(normalizeEventPart)
    .join("\u001f");
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(identity)
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 40);
}
