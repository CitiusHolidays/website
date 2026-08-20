const BRAND_NAME = "Citius Holidays";
const NAVY = "#0B1026";
const GOLD = "#d4af37";
const CREAM = "#FDFBF7";
const MUTED = "#64748b";

interface AuthEmailOptions {
  bodyParagraphs: string[];
  ctaHref: string;
  ctaLabel: string;
  footerNote: string;
  greetingName: string;
  headline: string;
}

export function buildAuthEmailHtml({
  greetingName,
  headline,
  bodyParagraphs,
  ctaHref,
  ctaLabel,
  footerNote,
}: AuthEmailOptions): string {
  const bodyHtml = bodyParagraphs
    .map((p) => `<p style="margin: 0 0 16px; color: #334155; line-height: 1.6;">${p}</p>`)
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin: 0; padding: 24px; background-color: ${CREAM}; font-family: Georgia, 'Times New Roman', serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; margin: 0 auto;">
    <tr>
      <td style="background: linear-gradient(135deg, ${NAVY} 0%, #1a2c4e 100%); border-radius: 16px 16px 0 0; padding: 32px 28px; text-align: center;">
        <p style="margin: 0 0 8px; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: ${GOLD}; font-family: system-ui, sans-serif;">${BRAND_NAME}</p>
        <h1 style="margin: 0; font-size: 26px; font-weight: 600; color: #ffffff; line-height: 1.3;">${headline}</h1>
      </td>
    </tr>
    <tr>
      <td style="background-color: #ffffff; padding: 28px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
        <p style="margin: 0 0 16px; color: #0f172a; font-size: 16px;">Hi ${greetingName},</p>
        ${bodyHtml}
        <p style="margin: 28px 0;">
          <a href="${ctaHref}" style="background-color: ${NAVY}; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; display: inline-block; font-family: system-ui, sans-serif;">${ctaLabel}</a>
        </p>
        <p style="margin: 0; color: ${MUTED}; font-size: 14px; line-height: 1.5;">${footerNote}</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px; padding: 20px 28px; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: ${MUTED}; font-family: system-ui, sans-serif;">© ${new Date().getFullYear()} ${BRAND_NAME}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export const AUTH_EMAIL_BRAND = BRAND_NAME;

export function prepareAuthEmailMessage(input: {
  ctaHref: string;
  greetingName: string;
  purpose: "password_reset" | "verification";
}) {
  if (input.purpose === "password_reset") {
    return {
      html: buildAuthEmailHtml({
        bodyParagraphs: [
          `We received a request to reset your password for your ${AUTH_EMAIL_BRAND} account. Click the button below to choose a new password.`,
        ],
        ctaHref: input.ctaHref,
        ctaLabel: "Reset password",
        footerNote: "If you did not request a password reset, you can safely ignore this email.",
        greetingName: input.greetingName,
        headline: "Reset your password",
      }),
      subject: `Reset your ${AUTH_EMAIL_BRAND} password`,
      text: `Reset your ${AUTH_EMAIL_BRAND} password using the secure link in this email.`,
    };
  }
  return {
    html: buildAuthEmailHtml({
      bodyParagraphs: [
        `Thank you for signing up with ${AUTH_EMAIL_BRAND}. Click the button below to verify your email address and activate your account.`,
      ],
      ctaHref: input.ctaHref,
      ctaLabel: "Verify email",
      footerNote: "If you did not sign up for an account, you can safely ignore this email.",
      greetingName: input.greetingName,
      headline: "Verify your email",
    }),
    subject: `Verify your ${AUTH_EMAIL_BRAND} account`,
    text: `Verify your ${AUTH_EMAIL_BRAND} account using the secure link in this email.`,
  };
}
