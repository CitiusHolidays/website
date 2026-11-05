const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function buildThankYouDraft(guest: { email?: string; fullName: string; jobCode?: string }) {
  const email = guest.email?.trim();
  if (!(email && EMAIL_PATTERN.test(email))) {
    return null;
  }
  const subject = `Thank you for travelling with Citius Holidays${guest.jobCode ? ` | ${guest.jobCode}` : ""}`;
  const body = `Dear ${guest.fullName},\n\nThank you for travelling with Citius Holidays. We hope you enjoyed your trip and would welcome your feedback.\n\nWarm regards,\nCitius Holidays`;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
