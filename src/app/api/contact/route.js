import { NextResponse } from "next/server";
import { deliverContactEmail } from "@/lib/contact/deliverContactEmail";
import { checkContactRateLimit } from "@/lib/contact/rate-limit";
import { renderContactFormEmail } from "@/lib/contact/renderContactEmail";
import {
  detectSpamContent,
  getClientIp,
  isAllowedSiteOrigin,
  isHoneypotTripped,
  validateFormTiming,
} from "@/lib/contact/spam-guard";
import { isTurnstileConfigured, verifyTurnstileToken } from "@/lib/contact/turnstile";
import { CONTACT_EMAIL_FROM, CONTACT_EMAIL_TO } from "@/lib/email/config";
import { isJsonObject, readJsonBodyWithinLimit } from "@/lib/http/readJsonBody";

const MAX_CONTACT_BODY_BYTES = 16 * 1024;
const CONTACT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_PHONE_PATTERN =
  /^(\+\d{1,3}[\s.-]?)?\(?([0-9]{3})\)?[\s.-]?([0-9]{3})[\s.-]?([0-9]{4})$/;

function rejectSpam() {
  return NextResponse.json(
    { error: "Unable to send your message. Please try again later." },
    { status: 400 }
  );
}

export async function POST(request) {
  if (!isAllowedSiteOrigin(request)) {
    return rejectSpam();
  }

  const bodyResult = await readJsonBodyWithinLimit(request, MAX_CONTACT_BODY_BYTES);
  if (!bodyResult.ok) {
    return NextResponse.json(
      { error: bodyResult.reason === "too_large" ? "Message is too large." : "Invalid request." },
      { status: bodyResult.reason === "too_large" ? 413 : 400 }
    );
  }

  if (!isJsonObject(bodyResult.value)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const clientIp = getClientIp(request);
  const rateLimit = checkContactRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please wait a few minutes and try again." },
      {
        headers: { "Retry-After": String(rateLimit.retryAfterSec) },
        status: 429,
      }
    );
  }

  const body = bodyResult.value;
  const { name, email, phone, subject, message, company, formLoadedAt, turnstileToken } = body;

  if (isHoneypotTripped(company)) {
    return rejectSpam();
  }

  const timing = validateFormTiming(formLoadedAt);
  if (!timing.ok) {
    return rejectSpam();
  }

  if (isTurnstileConfigured()) {
    const captcha = await verifyTurnstileToken(turnstileToken, clientIp);
    if (!captcha.ok) {
      return NextResponse.json(
        { error: "Security verification failed. Please refresh and try again." },
        { status: 400 }
      );
    }
  }

  // RESEND_API_KEY is canonical; RESEND_KEY remains a temporary deployment
  // alias so existing contact forms do not fail during key migration.
  const resendKey = process.env.RESEND_API_KEY?.trim() || process.env.RESEND_KEY?.trim();
  if (!resendKey) {
    return NextResponse.json({ error: "Email service not configured." }, { status: 500 });
  }

  const trimmedName = (name || "").toString().trim();
  const trimmedEmail = (email || "").toString().trim();
  const trimmedPhone = (phone || "").toString().trim();
  const trimmedSubject = (subject || "").toString().trim().slice(0, 120);
  const trimmedMessage = (message || "").toString().trim();

  if (!(trimmedName && trimmedEmail && trimmedMessage)) {
    return NextResponse.json(
      { error: "Please provide name, email, and message." },
      { status: 400 }
    );
  }

  if (!CONTACT_EMAIL_PATTERN.test(trimmedEmail)) {
    return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
  }

  if (trimmedPhone && !CONTACT_PHONE_PATTERN.test(trimmedPhone)) {
    return NextResponse.json(
      { error: "Please provide a valid phone number (e.g., +1 555-123-4567)." },
      { status: 400 }
    );
  }

  if (trimmedMessage.length > 5000) {
    return NextResponse.json({ error: "Message is too long." }, { status: 400 });
  }

  const spamCheck = detectSpamContent({
    email: trimmedEmail,
    message: trimmedMessage,
    name: trimmedName,
    subject: trimmedSubject,
  });
  if (spamCheck.spam) {
    console.info("[contact] Blocked spam submission:", spamCheck.reason, clientIp);
    return rejectSpam();
  }

  const emailHtml = await renderContactFormEmail({
    email: trimmedEmail,
    message: trimmedMessage,
    name: trimmedName,
    phone: trimmedPhone,
    receivedAtMs: Date.now(),
    subject: trimmedSubject || "Contact Form Message",
  });

  try {
    await deliverContactEmail({
      email: trimmedEmail,
      formLoadedAt,
      from: CONTACT_EMAIL_FROM,
      html: emailHtml,
      message: trimmedMessage,
      name: trimmedName,
      phone: trimmedPhone,
      subject: trimmedSubject || "Contact Form Message",
      to: CONTACT_EMAIL_TO,
    });
    return NextResponse.json({ message: "Email sent successfully!" }, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to send email. Please try again." }, { status: 500 });
  }
}
