import { render, toPlainText } from "@react-email/render";
import { createElement } from "react";
import { CitiusTransactionalEmail } from "./transactionalEmail";

export const AUTH_EMAIL_BRAND = "Citius Holidays";

interface AuthEmailOptions {
  bodyParagraphs: string[];
  ctaHref: string;
  ctaLabel: string;
  footerNote: string;
  greetingName: string;
  headline: string;
}

export function buildAuthEmailHtml(input: AuthEmailOptions) {
  return render(
    createElement(CitiusTransactionalEmail, {
      action: { href: input.ctaHref, label: input.ctaLabel },
      context: "Account security",
      footer: input.footerNote,
      greeting: input.greetingName,
      paragraphs: input.bodyParagraphs,
      title: input.headline,
    })
  );
}

export async function prepareAuthEmailMessage(input: {
  ctaHref: string;
  greetingName: string;
  purpose: "password_reset" | "verification";
}) {
  const reset = input.purpose === "password_reset";
  const html = await buildAuthEmailHtml({
    bodyParagraphs: [
      reset
        ? "A password reset was requested for your account. Choose a new password using the link below."
        : "Confirm this email address to finish setting up your account.",
    ],
    ctaHref: input.ctaHref,
    ctaLabel: reset ? "Reset password" : "Verify email",
    footerNote: reset
      ? "If you did not request a password reset, you can safely ignore this email."
      : "If you did not sign up for an account, you can safely ignore this email.",
    greetingName: input.greetingName,
    headline: reset ? "Reset your password" : "Verify your email",
  });
  return {
    html,
    subject: reset
      ? `Reset your ${AUTH_EMAIL_BRAND} password`
      : `Verify your ${AUTH_EMAIL_BRAND} account`,
    text: toPlainText(html, { wordwrap: 78 }),
  };
}

/**
 * The customer app's sign-in link (ADR 0020). `ctaHref` is the website's `/app/sign-in` page, which
 * hands the one-time token to the installed app; it never signs the browser in.
 */
export async function prepareAppSignInEmailMessage(input: { ctaHref: string }) {
  const html = await buildAuthEmailHtml({
    bodyParagraphs: [
      "Tap the button on the phone where you have the Citius Holidays app to sign in. The link works once and expires in 10 minutes.",
    ],
    ctaHref: input.ctaHref,
    ctaLabel: "Sign in to the app",
    footerNote: "If you did not ask to sign in, you can safely ignore this email.",
    greetingName: "there",
    headline: "Sign in to Citius Holidays",
  });
  return {
    html,
    subject: `Your ${AUTH_EMAIL_BRAND} sign-in link`,
    text: toPlainText(html, { wordwrap: 78 }),
  };
}

/** Sent once after a customer deletes their own account (ADR 0019); it carries no account link. */
export async function prepareAccountDeletedEmailMessage(input: { contactHref: string }) {
  const html = await render(
    createElement(CitiusTransactionalEmail, {
      action: { href: input.contactHref, label: "Contact Citius" },
      context: "Account security",
      footer:
        "If you did not delete your account, contact us straight away. We cannot restore a deleted account, but we can help you secure your bookings.",
      greeting: "there",
      paragraphs: [
        "Your Citius Holidays account was deleted at your request. You have been signed out everywhere, and your login, profile, saved trips and Sacred Bharat profile are gone.",
        "We keep the booking, payment and invoice records the tax rules require, detached from your login. Trip records our operations team holds for travellers are unchanged.",
      ],
      title: "Your account was deleted",
    })
  );
  return {
    html,
    subject: `Your ${AUTH_EMAIL_BRAND} account was deleted`,
    text: toPlainText(html, { wordwrap: 78 }),
  };
}
