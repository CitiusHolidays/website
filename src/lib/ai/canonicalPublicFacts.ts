import {
  PUBLIC_COMPANY_FACTS_VERSION,
  PUBLIC_COMPANY_PROFILE,
  PUBLIC_COMPANY_STATS,
  PUBLIC_COMPANY_STRENGTHS,
} from "@/data/publicCompanyFacts";
import { getPublicOffices } from "@/data/publicContacts";
import {
  PUBLIC_DESTINATIONS,
  PUBLIC_DESTINATIONS_VERSION,
  type PublicDestination,
  type PublicDestinationRegion,
} from "@/data/publicDestinations";
import {
  PUBLIC_HOME_SERVICES,
  PUBLIC_SERVICES,
  PUBLIC_SERVICES_VERSION,
  type PublicService,
  type PublicServiceCategory,
} from "@/data/publicServices";
import { getTrailBySlug } from "@/data/trails";
import { isJsonObject, type JsonObject, type JsonValue } from "@/lib/jsonValue";
import { isRuntimeString } from "../runtimeValues";

export const CANONICAL_PUBLIC_FACTS_VERSION = "2026-08-12";

export interface CanonicalPublicSource {
  id: string;
  version: string;
}

const LEAD_FIELDS = [
  "destination or region",
  "travel month or fixed dates",
  "number of travelers",
  "departure city",
  "travel purpose",
  "budget band, if available",
  "hotel category or comfort level",
  "visa/passport constraints for international travel",
  "event agenda, branding, and delegate profile for MICE groups",
] as const;

const COMPANY_SOURCE = {
  id: "src/data/publicCompanyFacts.ts",
  version: PUBLIC_COMPANY_FACTS_VERSION,
} as const;
const CONTACT_SOURCE = {
  id: "src/data/publicContacts.ts",
  version: CANONICAL_PUBLIC_FACTS_VERSION,
} as const;
const DESTINATION_SOURCE = {
  id: "src/data/publicDestinations.ts",
  version: PUBLIC_DESTINATIONS_VERSION,
} as const;
const SERVICE_SOURCE = {
  id: "src/data/publicServices.ts",
  version: PUBLIC_SERVICES_VERSION,
} as const;

const BOUNDARY_RULES = [
  {
    kind: "refusal",
    pattern:
      /\b(passport|payment secret|customer record|traveller record|staff record|finance record)\b/i,
    response:
      "I can only use approved public Citius information here. I cannot retrieve customer, traveller, staff, passport, payment, or finance records.",
    topic: "restricted-records",
  },
  {
    kind: "team-confirmation",
    pattern: /\b(visa approval|immigration|legal advice|legal ruling)\b/i,
    response:
      "Visa approval, immigration requirements, and legal guidance must be confirmed with the relevant authority and the Citius team.",
    topic: "visa-legal",
  },
  {
    kind: "team-confirmation",
    pattern: /\b(medical advice|fit to travel|health clearance)\b/i,
    response:
      "Medical suitability and health clearance require a qualified clinician; the Citius team can confirm only programme logistics.",
    topic: "medical",
  },
  {
    kind: "team-confirmation",
    pattern: /\b(price|quote|cost|availability|available|book now|guarantee)\b/i,
    response:
      "Live prices, quotes, booking availability, and guarantees must be confirmed by the Citius team.",
    topic: "live-commercial",
  },
  {
    kind: "team-confirmation",
    pattern: /\b(refund|payment status|payment dispute)\b/i,
    response:
      "Payment status, refund decisions, and disputes must be reviewed by the Citius team against the applicable booking record and policy.",
    topic: "payment-refund",
  },
] as const;

export function checkCanonicalPublicBoundary(question: string) {
  const matchedRule = BOUNDARY_RULES.find((rule) => rule.pattern.test(question));
  if (matchedRule) {
    return {
      kind: matchedRule.kind,
      response: matchedRule.response,
      source: {
        id: "src/lib/ai/canonicalPublicFacts.ts#boundary-policy",
        version: CANONICAL_PUBLIC_FACTS_VERSION,
      },
      topic: matchedRule.topic,
    };
  }
  return {
    kind: "public-facts-only",
    response:
      "Answer only from the canonical public fact tools. If the requested fact is absent or conflicting, ask the Citius team to confirm it.",
    source: {
      id: "src/lib/ai/canonicalPublicFacts.ts#boundary-policy",
      version: CANONICAL_PUBLIC_FACTS_VERSION,
    },
    topic: "public-facts",
  };
}

type CompanyProfileFocus = "contact" | "destinations" | "overview" | "services" | "trust";

interface CompanyTrustResult {
  positioning: string;
  promise: string;
  source: CanonicalPublicSource;
  stats: typeof PUBLIC_COMPANY_STATS;
  strengths: typeof PUBLIC_COMPANY_STRENGTHS;
}
interface CompanyServicesResult {
  services: readonly PublicService[];
  source: CanonicalPublicSource;
}
interface CompanyDestinationsResult {
  destinations: readonly PublicDestination[];
  source: CanonicalPublicSource;
}
type CompanyContactResult = ReturnType<typeof getCanonicalContactOptions>;
interface CompanyOverviewResult {
  profile: typeof PUBLIC_COMPANY_PROFILE & {
    stats: typeof PUBLIC_COMPANY_STATS;
    strengths: typeof PUBLIC_COMPANY_STRENGTHS;
  };
  source: CanonicalPublicSource;
  topServices: { summary: string; title: string; usefulFor: readonly string[] }[];
}

export function getCanonicalCompanyProfile(focus: "trust"): CompanyTrustResult;
export function getCanonicalCompanyProfile(focus: "services"): CompanyServicesResult;
export function getCanonicalCompanyProfile(focus: "destinations"): CompanyDestinationsResult;
export function getCanonicalCompanyProfile(focus: "contact"): CompanyContactResult;
export function getCanonicalCompanyProfile(focus?: "overview"): CompanyOverviewResult;
export function getCanonicalCompanyProfile(
  focus: CompanyProfileFocus = "overview"
):
  | CompanyContactResult
  | CompanyDestinationsResult
  | CompanyOverviewResult
  | CompanyServicesResult
  | CompanyTrustResult {
  if (focus === "services") {
    return { services: PUBLIC_SERVICES, source: SERVICE_SOURCE };
  }
  if (focus === "destinations") {
    return { destinations: PUBLIC_DESTINATIONS, source: DESTINATION_SOURCE };
  }
  if (focus === "contact") {
    return getCanonicalContactOptions();
  }
  if (focus === "trust") {
    return {
      positioning: PUBLIC_COMPANY_PROFILE.positioning,
      promise: PUBLIC_COMPANY_PROFILE.promise,
      source: COMPANY_SOURCE,
      stats: PUBLIC_COMPANY_STATS,
      strengths: PUBLIC_COMPANY_STRENGTHS,
    };
  }
  return {
    profile: {
      ...PUBLIC_COMPANY_PROFILE,
      stats: PUBLIC_COMPANY_STATS,
      strengths: PUBLIC_COMPANY_STRENGTHS,
    },
    source: COMPANY_SOURCE,
    topServices: PUBLIC_HOME_SERVICES.map((service) => ({
      summary: service.home.description,
      title: service.home.title,
      usefulFor: service.usefulFor,
    })),
  };
}

export function getCanonicalContactOptions(city = "") {
  const normalizedCity = normalizeText(city);
  const allOffices = getPublicOffices("contact").map((office) => ({
    address: office.address.contact,
    city: office.city,
    phone: office.displayPhone,
  }));
  const offices = normalizedCity
    ? allOffices.filter((office) => normalizeText(office.city).includes(normalizedCity))
    : allOffices;

  return {
    handoffCopy:
      "For personalized proposals and bookings, share these details through the Contact page or call the nearest Citius Holidays office.",
    offices: offices.length > 0 ? offices : allOffices,
    proposalHandoffFields: LEAD_FIELDS,
    source: CONTACT_SOURCE,
  };
}

type OfferingCategory = "all" | PublicDestinationRegion | PublicServiceCategory;

function normalizeText(value: JsonValue): string {
  return String(value ?? "").toLowerCase();
}

function matchesQuery(value: PublicDestination | PublicService, query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return !normalizedQuery || normalizeText(JSON.stringify(value)).includes(normalizedQuery);
}

function servicesForCategory(category: OfferingCategory): readonly PublicService[] {
  return category === "all"
    ? PUBLIC_SERVICES
    : PUBLIC_SERVICES.filter((service) => service.category === category);
}

function destinationsForCategory(category: OfferingCategory): readonly PublicDestination[] {
  return category === "all"
    ? PUBLIC_DESTINATIONS
    : PUBLIC_DESTINATIONS.filter((destination) => destination.region === category);
}

export function searchCanonicalOfferings(query = "", category: OfferingCategory = "all") {
  const categoryServices = servicesForCategory(category);
  const categoryDestinations = destinationsForCategory(category);
  const services = categoryServices.filter((service) => matchesQuery(service, query));
  const destinations = categoryDestinations.filter((destination) =>
    matchesQuery(destination, query)
  );

  return {
    destinations: destinations.length > 0 ? destinations : categoryDestinations,
    services: services.length > 0 ? services : categoryServices,
    sources: [SERVICE_SOURCE, DESTINATION_SOURCE] as const,
  };
}

type PilgrimageProgrammeType = "aerial" | "all" | "overland";

const PILGRIMAGE_PROGRAMMES = [
  { slug: "kailash-mansarovar-14day", type: "overland" },
  { slug: "kailash-aerial-3day", type: "aerial" },
] as const;

function requireRecord(value: JsonValue, source: string): JsonObject {
  if (!isJsonObject(value)) {
    throw new Error(`Canonical public fact is malformed: ${source}`);
  }
  return value;
}

function requireString(record: JsonObject, key: string, source: string): string {
  const value = record[key];
  if (!(isRuntimeString(value) && value.trim())) {
    throw new Error(`Canonical public fact is malformed: ${source}.${key}`);
  }
  return value;
}

function adaptPilgrimageProgramme(slug: string, type: Exclude<PilgrimageProgrammeType, "all">) {
  const sourceId = `src/data/trails/catalog.js#${slug}`;
  const trail = requireRecord(getTrailBySlug(slug), sourceId);
  const quickFacts = requireRecord(trail.quickFacts, `${sourceId}.quickFacts`);
  return {
    bestTime: requireString(quickFacts, "bestTime", `${sourceId}.quickFacts`),
    difficulty: requireString(quickFacts, "difficulty", `${sourceId}.quickFacts`),
    duration: requireString(quickFacts, "duration", `${sourceId}.quickFacts`),
    id: requireString(trail, "slug", sourceId),
    maxAltitude: requireString(quickFacts, "maxAltitude", `${sourceId}.quickFacts`),
    route: requireString(quickFacts, "route", `${sourceId}.quickFacts`),
    summary: requireString(trail, "subtitle", sourceId),
    title: requireString(trail, "title", sourceId),
    type,
  };
}

export function getCanonicalPilgrimagePrograms(programmeType: PilgrimageProgrammeType = "all") {
  const selected =
    programmeType === "all"
      ? PILGRIMAGE_PROGRAMMES
      : PILGRIMAGE_PROGRAMMES.filter((programme) => programme.type === programmeType);
  return {
    handoffNote:
      "Dates, permits, aviation feasibility, health readiness, and final inclusions must be confirmed by the Citius team.",
    programmes: selected.map((programme) =>
      adaptPilgrimageProgramme(programme.slug, programme.type)
    ),
    sources: selected.map((programme) => ({
      id: `src/data/trails/catalog.js#${programme.slug}`,
      version: CANONICAL_PUBLIC_FACTS_VERSION,
    })),
  };
}
