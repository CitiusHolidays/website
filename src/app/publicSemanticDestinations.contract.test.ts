import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPublicOffices } from "@/data/publicContacts";
import { POLICY_VIEW_HREFS, resolvePolicyView } from "./(public)/policies/policyView";

const root = process.cwd();

function read(relativePath: string) {
  return readFileSync(join(root, relativePath), "utf8");
}

const MICE_PAGE = "src/app/(public)/mice/page.client.js";
const PILGRIMAGE_PAGE = "src/app/(public)/pilgrimage/page.client.js";
const CONTACT_PAGE = "src/app/(public)/contact/page.client.js";
const POLICY_PAGE = "src/app/(public)/policies/page.client.js";
const FOOTER = "src/components/layout/Footer.js";
const LOCATION_CARD = "src/components/ui/LocationCard.js";
const MICE_GALLERY_LINK_PATTERN = /<Link[\s\S]*?href="\/gallery"[\s\S]*?>\s*View More\s*<\/Link>/;
const NESTED_LINK_BUTTON_PATTERN = /<Link[^>]*>\s*<button/;
const REQUEST_CALLBACK_LINK_PATTERN =
  /href=\{PILGRIMAGE_CONTACT_HREFS\.callback\}[\s\S]*?>\s*Request Callback\s*<\/Link>/;
const ENQUIRE_LINK_PATTERN =
  /href=\{PILGRIMAGE_CONTACT_HREFS\.enquiry\}[\s\S]*?>\s*Enquire\s*<\/Link>/;
const DUMMY_TEL_HREF_PATTERN = /href\s*=\s*["'`]tel:[^"'`]*[xX][^"'`]*["'`]/;
const DIAL_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
const NON_DIGIT_PATTERN = /\D/g;
const GENERAL_OFFICE_PHONE_LITERAL_PATTERN = /\+91\s*9\d{4}\s*\d{5}/;
const DIAL_HREF_SOURCE_PATTERN = /href=\{`tel:\$\{office\.dialPhone\}`\}/;
const LOCATION_CARD_DIAL_HREF_PATTERN = /href=\{`tel:\$\{dialPhone\}`\}/;

describe("public semantic destinations", () => {
  test("MICE View More is one styled gallery link without a nested button", () => {
    const source = read(MICE_PAGE);

    expect(source).toMatch(MICE_GALLERY_LINK_PATTERN);
    expect(source).toContain("focus-visible:outline-2");
    expect(source).not.toMatch(NESTED_LINK_BUTTON_PATTERN);
  });

  test("Pilgrimage mobile actions use the existing contact flow and no dummy telephone href", () => {
    const source = read(PILGRIMAGE_PAGE);

    expect(source).toMatch(REQUEST_CALLBACK_LINK_PATTERN);
    expect(source).toMatch(ENQUIRE_LINK_PATTERN);
    expect(source).not.toMatch(DUMMY_TEL_HREF_PATTERN);
  });

  test("general offices preserve each surface order and expose independently valid dial values", () => {
    const contactOffices = getPublicOffices("contact");
    const footerOffices = getPublicOffices("footer");

    expect(contactOffices.map(({ city }) => city)).toEqual(["Kolkata", "Mumbai", "Bengaluru"]);
    expect(footerOffices.map(({ city }) => city)).toEqual(["Mumbai", "Bengaluru", "Kolkata"]);
    expect(contactOffices.map(({ displayPhone }) => displayPhone)).toEqual([
      "+91 98310 82929",
      "+91 9920993259",
      "+91 99008 14292",
    ]);

    for (const office of contactOffices) {
      expect(office.dialPhone).toMatch(DIAL_PHONE_PATTERN);
      expect(office.dialPhone).toBe(`+${office.displayPhone.replace(NON_DIGIT_PATTERN, "")}`);
      expect(office.address.contact.length).toBeGreaterThan(0);
      expect(office.address.footer.length).toBeGreaterThan(0);
    }
  });

  test("Footer and Contact consume the typed office directory without duplicating contact values", () => {
    const contactSource = read(CONTACT_PAGE);
    const footerSource = read(FOOTER);
    const locationCardSource = read(LOCATION_CARD);

    for (const source of [contactSource, footerSource]) {
      expect(source).toContain('from "@/data/publicContacts"');
      expect(source).not.toMatch(GENERAL_OFFICE_PHONE_LITERAL_PATTERN);
    }
    expect(contactSource).toContain('getPublicOffices("contact")');
    expect(footerSource).toContain('getPublicOffices("footer")');
    expect(contactSource).toContain('import LocationCard from "@/components/ui/LocationCard"');
    expect(contactSource).toContain("dialPhone={office.dialPhone}");
    expect(contactSource).not.toContain("function OfficeLocationCard");
    expect(locationCardSource).toContain("dialPhone = phone");
    expect(locationCardSource).toMatch(LOCATION_CARD_DIAL_HREF_PATTERN);
    expect(footerSource).toMatch(DIAL_HREF_SOURCE_PATTERN);
  });

  test("policy URL values resolve billing explicitly and default every other state to Terms", () => {
    expect(POLICY_VIEW_HREFS).toEqual({
      billing: "/policies?view=billing",
      terms: "/policies?view=terms",
    });
    expect(resolvePolicyView("billing")).toBe("billing");
    expect(resolvePolicyView("terms")).toBe("terms");
    expect(resolvePolicyView(undefined)).toBe("terms");
    expect(resolvePolicyView("")).toBe("terms");
    expect(resolvePolicyView("privacy")).toBe("terms");
  });

  test("footer destinations and policy navigation share the stable URL-state contract", () => {
    const footerSource = read(FOOTER);
    const policySource = read(POLICY_PAGE);

    expect(footerSource).toContain('href="/policies?view=terms"');
    expect(footerSource).toContain('href="/policies?view=billing"');
    expect(policySource).not.toContain("useSearchParams");
    expect(policySource).toContain('aria-label="Policy documents"');
    expect(policySource).toContain('aria-controls="policy-document"');
    expect(policySource).toContain('aria-current={activeTab === tab.id ? "page" : undefined}');
    expect(policySource).toContain("scroll={false}");
    expect(policySource).not.toContain("<Suspense");
  });

  test("existing Billing and Customer Support policy contacts remain separate and unchanged", () => {
    const source = read(POLICY_PAGE);

    expect(source).toContain("Citius Holidays – Accounts Team");
    expect(source).toContain("+91 98304 28789");
    expect(source).toContain("Citius Holidays – Customer Support");
    expect(source).toContain("+91 90387 65012");
  });
});
