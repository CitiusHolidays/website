import { describe, expect, test } from "bun:test";
import {
  buildNotificationHtml,
  buildNotificationText,
  notificationEmailSummaryDetails,
} from "./notificationEmailContent";

describe("portable notification email content", () => {
  test("keeps useful trip context while private reasons, documents and commercial notes stay in the portal", () => {
    const details = notificationEmailSummaryDetails(
      {
        rows: [
          { label: "Job Card", value: "JC-0264" },
          { label: "Destination", value: "Bali" },
          { label: "Pax", value: "36" },
          { label: "Reason", value: "private medical reason" },
          { label: "Passport last four", value: "9876" },
          { label: "Cost price / pax", value: "confidential margin" },
          { label: "Notes", value: "private staff note" },
        ],
        title: "Trip details",
      },
      "jobCard"
    );
    const content = {
      body: "Review the assigned work.",
      details,
      href: "https://example.invalid/portal/job-cards?open=jobCard&id=demo",
      title: "Job Card opened",
    };
    const html = buildNotificationHtml(content);
    const text = buildNotificationText(content);
    for (const rendered of [html, text]) {
      expect(rendered).toContain("JC-0264");
      expect(rendered).toContain("Bali");
      for (const privateValue of [
        "private medical reason",
        "9876",
        "confidential margin",
        "private staff note",
      ]) {
        expect(rendered).not.toContain(privateValue);
      }
    }
  });
  test("retains the enquiry message for the explicitly approved inbound follow-up purpose and escapes markup", () => {
    const details = notificationEmailSummaryDetails(
      { rows: [{ label: "Notes", value: "Please call about <Bali>" }], title: "Enquiry" },
      "inboundQueryIntent"
    );
    const content = {
      body: "New enquiry",
      details,
      href: "https://example.invalid/portal",
      title: "New <enquiry>",
    };
    expect(buildNotificationHtml(content)).toContain("Please call about &lt;Bali&gt;");
    expect(buildNotificationHtml(content)).not.toContain("<enquiry>");
    expect(buildNotificationText(content)).toContain("Please call about <Bali>");
  });
});
