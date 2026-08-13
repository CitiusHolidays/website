const CONTACT_VALIDATION_MESSAGES = new Set([
  "Please provide your name and consent to be contacted.",
  "Please provide a valid email address.",
  "Please provide a valid mobile number.",
  "Please provide an email address or mobile number.",
  "Security verification failed. Please refresh and try again.",
]);

const PROFILE_VALIDATION_MESSAGES = new Set([
  "Please provide your full name (at least 2 characters).",
  "Name is too long. Please keep it under 80 characters.",
  "Please provide a valid phone number (e.g., +1 555-123-4567).",
]);

function normalizedMessage(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function readJsonError(response) {
  try {
    const body = await response.json();
    return normalizedMessage(body?.error);
  } catch {
    return "";
  }
}

export function formatContactSubmissionError({ message, status } = {}) {
  const candidate = normalizedMessage(message);
  if (status === 429) {
    return "Too many enquiries. Please wait a few minutes and try again.";
  }
  if (status === 413) {
    return "Your enquiry is too long to send. Shorten the message and try again.";
  }
  if (CONTACT_VALIDATION_MESSAGES.has(candidate)) {
    return candidate;
  }
  if (status === 400) {
    return "We could not send your enquiry. Check the form details and try again.";
  }
  if (status === 401 || status === 403) {
    return "We could not verify this enquiry. Refresh the page and try again.";
  }
  return "We could not send your enquiry because the service is temporarily unavailable. Your details are still here—please try again.";
}

export function formatProfileUpdateError({ message, status } = {}) {
  const candidate = normalizedMessage(message);
  if (PROFILE_VALIDATION_MESSAGES.has(candidate)) {
    return candidate;
  }
  if (status === 401) {
    return "Your session expired. Sign in again, then retry your profile update.";
  }
  if (status === 404) {
    return "We could not find your account profile. Refresh the page or sign in again.";
  }
  return "We could not update your profile right now. Your changes are still here—please try again.";
}

export function formatConciergeResponseError(status) {
  if (status === 429) {
    return "Citius Concierge is handling many requests. Please try again shortly.";
  }
  if (status === 413) {
    return "That message is too long for Citius Concierge. Shorten it and try again.";
  }
  if (status === 400) {
    return "Citius Concierge could not read that request. Edit your message and try again.";
  }
  if (status === 401 || status === 403) {
    return "Citius Concierge could not verify this request. Refresh the page and try again.";
  }
  return "Citius Concierge is temporarily unavailable. Please try again.";
}

export function formatJourneyPlannerResponseError(status) {
  if (status === 429) {
    return "Sacred Bharat Journey Planner is handling many requests. Please try again shortly.";
  }
  if (status === 413) {
    return "That request is too large for the Sacred Bharat Journey Planner. Shorten it and try again.";
  }
  if (status === 400) {
    return "Sacred Bharat Journey Planner could not read that request. Update your selections and try again.";
  }
  if (status === 401 || status === 403) {
    return "Sacred Bharat Journey Planner could not verify this request. Refresh the page and try again.";
  }
  return "Sacred Bharat Journey Planner could not complete that response. Please try again.";
}
