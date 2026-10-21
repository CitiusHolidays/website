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
        ? `We received a request to reset your password for your ${AUTH_EMAIL_BRAND} account. Click the button below to choose a new password.`
        : `Thank you for signing up with ${AUTH_EMAIL_BRAND}. Click the button below to verify your email address and activate your account.`,
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
