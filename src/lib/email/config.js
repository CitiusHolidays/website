/** Resend verified domain for outbound mail */
const SEND_DOMAIN = "citiusholidays.com";

/** Signup verification, password reset, staff portal invite (to: user's email) */
export const AUTH_EMAIL_FROM = `Citius Holidays <noreply@${SEND_DOMAIN}>`;

/** Contact form notification sender */
export const CONTACT_EMAIL_FROM = `Citius Holidays <website@${SEND_DOMAIN}>`;

/** Internal inbox for website contact submissions */
export const CONTACT_EMAIL_TO = "info@citius.in";
