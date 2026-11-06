import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { plainText } from "./policyText";
import { POLICY_VIEW_HREFS } from "./policyView";
import { privacyPolicy, TO_CONFIRM_PATTERN } from "./privacyPolicy";

const DAY_MS = 24 * 60 * 60 * 1000;
const LEGAL_NAME_MARKER = /\[To confirm: full legal name/;
const PRIVACY_LINK_REFERENCE = /privacyPolicyLink, "\."\)/g;

function sectionText(section) {
  return [
    section.heading,
    section.text ? plainText(section.text) : "",
    ...(section.list ?? []).map(plainText),
    ...(section.subsections ?? []).flatMap((sub) => [sub.title, ...sub.list.map(plainText)]),
  ].join("\n");
}

const policyText = [privacyPolicy.intro, ...privacyPolicy.content.map(sectionText)].join("\n");

function source(path) {
  return readFileSync(path, "utf8");
}

function numericConstant(path, name) {
  const match = source(path).match(new RegExp(`const ${name} = ([\\d\\s*_]+);`));
  if (!match) {
    throw new Error(`Expected ${name} in ${path}`);
  }
  return match[1]
    .split("*")
    .map((factor) => Number(factor.replaceAll("_", "").trim()))
    .reduce((product, factor) => product * factor, 1);
}

describe("Draft Privacy Policy", () => {
  test("covers the notice and Data Principal rights the DPDP Act requires", () => {
    for (const topic of [
      "Data Fiduciary",
      "Withdrawing consent",
      "Access:",
      "Correction:",
      "Erasure:",
      "Grievance redressal:",
      "Nomination:",
      "Data Protection Board of India",
      "Children",
      "Transfers outside India",
      "How long we keep your data",
    ]) {
      expect(policyText.toLowerCase()).toContain(topic.toLowerCase());
    }
  });

  test("marks every unresolved point for review, including the fiduciary and Grievance Officer", () => {
    const markers = policyText.match(TO_CONFIRM_PATTERN) ?? [];
    expect(markers.length).toBeGreaterThanOrEqual(15);
    expect(privacyPolicy.draftNotice).toContain("Draft for legal and management review");
    const whoWeAre = sectionText(privacyPolicy.content[0]);
    expect(whoWeAre).toMatch(LEGAL_NAME_MARKER);
    const grievance = privacyPolicy.content.find((section) =>
      section.heading.includes("Grievance")
    );
    expect(grievance?.list?.[0]).toBe(
      "Grievance Officer: [To confirm: name of the Grievance Officer]."
    );
  });

  test("states only the retention periods the code sets", () => {
    expect(
      numericConstant("convex/crm/officeCheckInRetention.ts", "OFFICE_CHECK_IN_RETENTION_DAYS")
    ).toBe(92);
    expect(policyText).toContain("Staff office check-in records are deleted after 92 days.");

    expect(
      numericConstant("convex/crm/commercialFilePolicy.ts", "COMMERCIAL_FILE_RETENTION_MS")
    ).toBe(14 * DAY_MS);
    expect(policyText).toContain("can be restored for 14 days and are then permanently deleted");

    expect(
      numericConstant("convex/crm/passengerExportPolicy.ts", "PASSENGER_EXPORT_ARTIFACT_TTL_MS")
    ).toBe(15 * 60 * 1000);
    expect(policyText).toContain("Temporary passenger list exports are deleted after 15 minutes.");

    expect(numericConstant("convex/aiRuntime.ts", "TELEMETRY_RETENTION_MS")).toBe(30 * DAY_MS);
    expect(numericConstant("convex/sacredBharatEditionEvents.ts", "ATTRIBUTION_WINDOW_MS")).toBe(
      30 * DAY_MS
    );
    expect(policyText).toContain("AI chat usage records are deleted after 30 days.");
    expect(policyText).toContain("Sacred Bharat Edition game events are deleted after 30 days.");

    expect(numericConstant("convex/lib/authEmailDelivery.ts", "AUTH_EMAIL_TOKEN_TTL_SECONDS")).toBe(
      60 * 60
    );
    expect(source("convex/betterAuth/auth.ts")).toContain("expiresIn: THIRTY_DAYS_IN_SECONDS");
    expect(policyText).toContain(
      "Sign-in sessions expire after 30 days. Email verification and password reset links expire after 1 hour."
    );

    expect(source("convex/crm/fieldPassports.ts")).toContain(
      "closes at 24:00 IST on the day after travel ends"
    );
    expect(policyText).toContain("at midnight IST at the end of the day after the trip ends");
  });

  test("names the processors the code actually calls", () => {
    expect(source("src/app/api/chat/route.js")).toContain("@openrouter/ai-sdk-provider");
    expect(source("convex/crm/notificationEmailProvider.ts").toLowerCase()).toContain("resend");
    expect(source("src/components/ui/TurnstileWidget.js")).toContain("challenges.cloudflare.com");
    expect(source("vercel.json")).toContain('"bom1"');
    for (const processor of [
      "Vercel",
      "Convex",
      "Resend",
      "Razorpay",
      "Cloudflare Turnstile",
      "OpenRouter",
      "Google",
      "Sanity",
    ]) {
      expect(policyText).toContain(processor);
    }
    expect(policyText).toContain("Vercel’s Mumbai region");
  });

  test("is reachable from the footer and from the Terms and Billing references", () => {
    const footer = source("src/components/layout/Footer.js");
    for (const href of Object.values(POLICY_VIEW_HREFS)) {
      expect(footer).toContain(`href="${href}"`);
    }
    const policyPage = source("src/app/(public)/policies/page.client.js");
    expect(policyPage).not.toContain(
      '"Customer personal data is handled as per our Privacy Policy."'
    );
    expect(policyPage).not.toContain('"Customer data is protected under our Privacy Policy."');
    expect(policyPage.match(PRIVACY_LINK_REFERENCE)).toHaveLength(2);
  });
});
