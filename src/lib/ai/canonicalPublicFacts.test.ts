import { describe, expect, test } from "bun:test";
import { PUBLIC_HOME_SERVICES } from "@/data/publicServices";
import {
  CANONICAL_PUBLIC_FACTS_VERSION,
  getCanonicalCompanyProfile,
  getCanonicalContactOptions,
  getCanonicalPilgrimagePrograms,
  searchCanonicalOfferings,
} from "./canonicalPublicFacts";

describe("Canonical public facts adapter", () => {
  test("Projects current company claims and all eleven public services with source identity", () => {
    const profile = getCanonicalCompanyProfile("trust");
    const services = getCanonicalCompanyProfile("services");

    expect(profile.source).toEqual({
      id: "src/data/publicCompanyFacts.ts",
      version: CANONICAL_PUBLIC_FACTS_VERSION,
    });
    expect(profile.stats).toContainEqual({ label: "Happy Travelers", value: 99_768 });
    expect(services.services).toHaveLength(11);
    expect(services.services.map((service) => service.title)).toEqual([
      "MICE",
      "VISA Assistance",
      "Event Management",
      "International Travel",
      "Domestic Travel",
      "Travel Insurance",
      "Branding",
      "Celebrity Management",
      "Sporting Events",
      "Onsite Travel Desk",
      "Spiritual Trails",
    ]);
    expect(PUBLIC_HOME_SERVICES.map((service) => service.home.title)).toEqual([
      "MICE Excellence",
      "Global Voyages",
      "Domestic Gems",
      "Elite Sports",
    ]);
  });

  test("Uses the same contact and destination records as public UI surfaces", () => {
    const contacts = getCanonicalContactOptions("Bengaluru");
    const destinations = searchCanonicalOfferings("Vietnam", "international");

    expect(contacts.offices).toEqual([
      {
        address:
          "Pachie's 3rd Floor, Building Number: 982, 3rd Cross Road, Kalyan Nagar, Bengaluru 560043",
        city: "Bengaluru",
        phone: "+91 99008 14292",
      },
    ]);
    expect(contacts.source.id).toBe("src/data/publicContacts.ts");
    expect(destinations.destinations).toContainEqual(
      expect.objectContaining({ name: "Vietnam (Phu Quoc & Da Nang)", region: "international" })
    );
    expect(destinations.sources.map((source) => source.id)).toContain(
      "src/data/publicDestinations.ts"
    );
  });

  test("Adapts published pilgrimage fields and keeps feasibility with the team", () => {
    const result = getCanonicalPilgrimagePrograms("aerial");

    expect(result.programmes).toEqual([
      expect.objectContaining({
        duration: "2 Nights / 3 Days",
        id: "kailash-aerial-3day",
        title: "Kailash Mansarovar Aerial View Tour",
        type: "aerial",
      }),
    ]);
    expect(result.handoffNote).toContain("must be confirmed by the Citius team");
    expect(result.sources[0]?.id).toContain("src/data/trails/catalog.js#");
  });
});
