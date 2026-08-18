import { isRuntimeString } from "./runtimeValues";

const OAUTH_LINK_ERRORS = new Set([
  "account not linked",
  "unable to link account",
  "oauth_link_error",
  "linking_not_allowed",
]);

export function formatAuthCallbackError(errorParam) {
  if (!errorParam) {
    return "";
  }
  let normalized;
  try {
    normalized = decodeURIComponent(String(errorParam)).toLowerCase();
  } catch {
    return "Sign-in failed. Please try again or use a different sign-in method.";
  }
  if (OAUTH_LINK_ERRORS.has(normalized) || normalized.includes("account not linked")) {
    return "We could not link Google to this email. Sign in with email and password, or use Forgot password to add a password to your existing account.";
  }
  if (normalized.includes("invalid_token")) {
    return "This sign-in link expired. Please try again.";
  }
  return "Sign-in failed. Please try again or use a different sign-in method.";
}

export function formatAuthApiError(message, code) {
  const text = isRuntimeString(message) ? message.toLowerCase() : "";
  const errorCode = isRuntimeString(code) ? code.toLowerCase() : "";

  if (errorCode === "email_not_verified" || text.includes("email not verified")) {
    return "Verify your email first. We sent a new verification link to your inbox.";
  }

  if (
    errorCode === "invalid_email_or_password" ||
    text.includes("invalid email") ||
    text.includes("invalid password")
  ) {
    return "Incorrect email or password. If you signed up with Google, use Continue with Google, or use Forgot password to set a password for this email.";
  }

  if (
    text.includes("already") ||
    text.includes("exists") ||
    text.includes("duplicate") ||
    errorCode.includes("already_exists")
  ) {
    return "An account with this email already exists. Check your inbox for a sign-in or password email, use Forgot password, or sign in with Google.";
  }

  if (errorCode.includes("too_many") || text.includes("too many") || text.includes("rate limit")) {
    return "Too many sign-in attempts. Wait a few minutes, then try again.";
  }

  return "We could not sign you in. Check your connection and try again, or use Forgot password.";
}

export function formatAuthRecoveryError(message, operation) {
  const text = isRuntimeString(message) ? message.toLowerCase() : "";
  if (
    text.includes("expired") ||
    text.includes("invalid token") ||
    text.includes("invalid_token") ||
    text.includes("token is invalid")
  ) {
    return "This password link is invalid or expired. Request a new link and try again.";
  }
  if (text.includes("too many") || text.includes("rate limit")) {
    return "Too many recovery attempts. Wait a few minutes, then try again.";
  }
  if (operation === "request") {
    return "We could not send a reset link right now. Check your connection and try again.";
  }
  return "We could not reset your password. Request a new link and try again.";
}
