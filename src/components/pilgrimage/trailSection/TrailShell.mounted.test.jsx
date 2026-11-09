import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TrailCta, TrailTabContent } from "./TrailShell";

const plain = (markup) =>
  markup
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const TRAIL = {
  bookingOptions: [{ href: "/contact", label: "Synthetic booking", note: "Synthetic note" }],
  highlights: [{ description: "Synthetic highlight description", name: "Synthetic highlight" }],
  overview: { intro: ["Synthetic overview paragraph"], title: "Synthetic overview" },
};
const ALL_FLAGS = {
  hasBlogs: true,
  hasBooking: true,
  hasGallery: true,
  hasHighlights: true,
  hasInfo: true,
  hasItinerary: true,
  hasMedia: true,
  hasPackageDetails: true,
  hasReviews: true,
};
const panelText = (activeTab, { flags = ALL_FLAGS, trail = TRAIL } = {}) =>
  plain(
    renderToStaticMarkup(
      <TrailTabContent
        activeTab={activeTab}
        flags={flags}
        relatedBlogPosts={[]}
        reviewsList={[]}
        trail={trail}
      />
    )
  );

describe("Trail tab content", () => {
  test("Renders only the active tab's panel", () => {
    const overview = panelText("overview");
    expect(overview).toContain("Synthetic overview paragraph");
    expect(overview).not.toContain("Synthetic highlight");

    const highlights = panelText("highlights");
    expect(highlights).toContain("Synthetic highlight");
    expect(highlights).not.toContain("Synthetic overview paragraph");
  });

  test("Leaves the panel empty when the trail lacks that tab's content", () => {
    expect(panelText("itinerary")).toBe("");
    expect(panelText("details")).toBe("");
    expect(panelText("highlights", { trail: { ...TRAIL, highlights: undefined } })).toBe("");
  });

  test("Gates flag-driven tabs on their flag rather than the raw trail data", () => {
    expect(panelText("booking")).toContain("Synthetic booking");
    expect(panelText("booking", { flags: { ...ALL_FLAGS, hasBooking: false } })).toBe("");
  });

  test("Renders nothing for an unknown tab id", () => {
    expect(panelText("constructor")).toBe("");
    expect(panelText("not-a-tab")).toBe("");
  });
});

describe("Trail closing call to action", () => {
  test("Asks for interest, not a brochure, on a trail with no departures yet", () => {
    const comingSoon = plain(renderToStaticMarkup(<TrailCta isAerial={false} isComingSoon />));
    expect(comingSoon).toContain("Register your interest");
    expect(comingSoon).not.toContain("departure batches");
    expect(comingSoon).not.toContain("Brochure");
  });

  test("Sends both versions to the pilgrimage enquiry", () => {
    for (const isComingSoon of [false, true]) {
      const markup = renderToStaticMarkup(
        <TrailCta isAerial={false} isComingSoon={isComingSoon} />
      );
      expect(markup).toContain('href="/contact?intent=pilgrimage-enquiry"');
    }
  });
});
