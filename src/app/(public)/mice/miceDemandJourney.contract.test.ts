import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const stagePattern = /data-mice-stage=/g;

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("MICE proposal demand journey", () => {
  test("owns exactly six semantic stages with one consistent proposal destination", () => {
    const page = read("src/app/(public)/mice/page.client.js");

    expect(page.match(stagePattern)).toHaveLength(6);
    expect(page).toContain("<h1");
    expect(page).toContain("Request a Proposal");
    expect(page).toContain('loading="eager"');
    expect(page.match(/href=\{MICE_PROPOSAL_CONTACT_HREF\}/g)).toHaveLength(2);
    expect(page).toContain("<GalleryGridSmall");
    expect(page).toContain('href="/gallery"');
    expect(page).toContain("View More");
  });

  test("preserves the approved capability, proof, support, and media contracts", () => {
    const page = read("src/app/(public)/mice/page.client.js");

    for (const value of [
      "Meetings",
      "Incentives",
      "Conferences",
      "Exhibitions",
      "Designated Account Manager",
      "Long-term Relationship Continuity",
      "Cost Optimization Tips",
      "24/7 On-ground Support",
      "15 glorious years",
      "/gallery/mice.webp",
    ]) {
      expect(page).toContain(value);
    }
  });

  test("routes an editable brief through the existing consented Website intake", () => {
    const intent = read("src/lib/public/contactIntent.ts");
    const form = read("src/components/ui/ModernContactForm.js");

    expect(intent).toContain('MICE_PROPOSAL_CONTACT_HREF = "/contact?intent=mice-proposal"');
    expect(intent).toContain('subject: "MICE proposal request"');
    expect(form).toContain('fetch("/api/inbound-intents"');
    expect(form).toContain('source: "Website"');
    expect(form).toContain("consent: fields.consent");
    expect(form).toContain('"Idempotency-Key": submissionKeyRef.current');
  });
});
