import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { plainText } from "./policyText";
import { POLICY_VIEW_HREFS } from "./policyView";
import { privacyPolicy, TO_CONFIRM_PATTERN } from "./privacyPolicy";

const DAY_MS = 24 * 60 * 60 * 1000;
const RULES_CITATION_MARKER = /\[To confirm: legal to confirm the citation of the Rules/;
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

const RETENTION_SCHEDULE = "convex/crm/lib/retentionSchedule.ts";

function scheduledPeriod(key) {
  const match = source(RETENTION_SCHEDULE).match(
    new RegExp(`\\b${key}: \\{ (days|years): (\\d+) \\}`)
  );
  if (!match) {
    throw new Error(`Expected RETENTION_PERIODS.${key} in ${RETENTION_SCHEDULE}`);
  }
  return { [match[1]]: Number(match[2]) };
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
    expect(markers.map((marker) => marker.slice("[To confirm: ".length, -1))).toEqual([
      "legal to confirm the citation of the Rules and which provisions are in force on the publication date.",
      "full legal name of the entity (the Kolkata office map listing reads “Citius Holidays Private Limited”), its CIN and its registered office address.",
      "legal to confirm the lawful basis for each purpose above.",
      "whether Citius will also accept requests made through a Consent Manager registered with the Data Protection Board.",
      "data processing agreements are in place with each of these providers.",
      "our role under each corporate or MICE contract; legal to review the standard contract terms.",
      "the region of our Convex database and file storage.",
      "name of the Grievance Officer",
      "dedicated privacy or grievance email address",
      "phone number",
      "postal address for privacy requests",
      "whether info@citiusholidays.com should be used for privacy requests.",
    ]);
    expect(privacyPolicy.intro).toMatch(RULES_CITATION_MARKER);
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

  test("states the director's retention schedule exactly as the retention module sets it", () => {
    const schedule = [
      [
        "unconvertedEnquiries",
        { years: 2 },
        "Website enquiries that did not become a trip: 2 years.",
      ],
      [
        "inactiveCustomerAccounts",
        { years: 3 },
        "Customer accounts: until you delete your account, or 3 years after its last activity.",
      ],
      [
        "bookingRecords",
        { years: 8 },
        "Bookings, payment records and invoices: 8 years, as tax rules require.",
      ],
      ["travellersAfterTrip", { years: 3 }, "Traveller records: 3 years after the trip."],
      [
        "passportScansAfterTrip",
        { days: 90 },
        "Passport details and scans: deleted 90 days after the trip.",
      ],
      ["feedback", { years: 3 }, "Feedback responses and photos: 3 years."],
      ["activityLogs", { days: 365 }, "Our office staff’s access and activity logs: 1 year."],
    ];
    for (const [key, period, statement] of schedule) {
      expect(scheduledPeriod(key)).toEqual(period);
      expect(policyText).toContain(statement);
    }

    expect(numericConstant(RETENTION_SCHEDULE, "FIELD_PASSPORT_AUDIT_RETENTION_DAYS")).toBe(365);
    expect(source("convex/crm/fieldPassports.ts")).toContain(
      "retainUntil: window.closesAt + FIELD_PASSPORT_AUDIT_RETENTION_DAYS * RETENTION_DAY_MS"
    );
    expect(source("convex/crm/fieldPassports.ts")).toContain(
      "and Admin read the log (director decision, 7 Nov 2026)"
    );
    expect(policyText).toContain(
      "Records of each time a tour manager opens a passport in Citius Connect: 1 year after the trip. Only our Operations Head and Admin can see them."
    );
  });

  test("states only the short retention periods the code sets", () => {
    expect(
      numericConstant("convex/crm/officeCheckInRetention.ts", "OFFICE_CHECK_IN_RETENTION_DAYS")
    ).toBe(92);
    expect(policyText).toContain("Staff office check-in records: 92 days.");

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
    expect(policyText).toContain(
      "only from the day before the trip starts until the day after it ends"
    );
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

  test("reflects the director's decisions on deletion, children, emails, AI and embeds", () => {
    const deletionLinks = privacyPolicy.content
      .flatMap((section) => section.list ?? [])
      .filter((item) => item.kind === "rich")
      .flatMap((item) => item.parts)
      .filter((part) => part.kind === "link")
      .map((part) => part.href);
    expect(deletionLinks).toContain("/account?tab=settings#delete-account");
    expect(deletionLinks).not.toContain("/contact?intent=account-deletion");
    expect(policyText).toContain("We keep your bookings, payment records and invoices for 8 years");
    expect(policyText).toContain("we respond to privacy requests within 30 days");
    expect(policyText).toContain("A child never has a login of their own.");
    expect(policyText).toContain("up to two parents or guardians travelling on the same trip");
    expect(policyText).toContain(
      "records “parental consent received” on the child’s traveller record"
    );
    expect(policyText).toContain("You can download it from Journeys in your account.");
    expect(policyText).toContain("its leaderboard is public by default");
    expect(policyText).toContain("They may keep what you send them under their own terms.");
    expect(policyText).toContain("Google may set its own cookies when they load.");
  });
});
