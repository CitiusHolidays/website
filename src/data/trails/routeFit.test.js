import { describe, expect, test } from "bun:test";
import { PILGRIMAGE_CONTACT_HREFS } from "@/lib/public/contactIntent";
import { TRAILS } from "../trails";
import {
  getPilgrimageTrailContactHref,
  getPublishedPilgrimageRouteFitOptions,
  resolvePilgrimageTrailContactContext,
} from "./routeFit";

describe("Pilgrimage route-fit data", () => {
  test("projects only published programmes with reviewed duration and route facts", () => {
    const options = getPublishedPilgrimageRouteFitOptions();

    expect(options.map((option) => option.slug)).toEqual([
      "kailash-mansarovar-14day",
      "kailash-aerial-3day",
    ]);

    for (const option of options) {
      const trail = TRAILS.find((candidate) => candidate.slug === option.slug);
      expect(trail?.status).toBe("published");
      expect(option).toMatchObject({
        contactHref: `${PILGRIMAGE_CONTACT_HREFS.enquiry}&trail=${option.slug}`,
        detailHref: `/pilgrimage/${option.slug}`,
        duration: trail?.quickFacts?.duration,
        route: trail?.quickFacts?.route,
        title: trail?.title,
      });
    }
  });

  test("carries an exact catalog slug and rejects hostile or ambiguous values", () => {
    expect(resolvePilgrimageTrailContactContext("kora-east-trail")).toEqual({
      slug: "kora-east-trail",
      status: "comingSoon",
      title: "East Trail",
    });
    expect(getPilgrimageTrailContactHref("enquiry", "kora-east-trail")).toBe(
      "/contact?intent=pilgrimage-enquiry&trail=kora-east-trail"
    );

    for (const value of [
      "__proto__",
      "constructor",
      "kora-east-trail/../corporate-retreat",
      "kora-east-trail?intent=account-deletion",
      ["kora-east-trail"],
      { slug: "kora-east-trail" },
    ]) {
      expect(resolvePilgrimageTrailContactContext(value)).toBeNull();
      expect(getPilgrimageTrailContactHref("enquiry", value)).toBe(
        PILGRIMAGE_CONTACT_HREFS.enquiry
      );
    }
  });
});
