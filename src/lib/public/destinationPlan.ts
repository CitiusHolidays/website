import {
  PUBLIC_DESTINATIONS,
  PUBLIC_DESTINATIONS_VERSION,
  type PublicDestination,
  type PublicDestinationRegion,
} from "@/data/publicDestinations";
import {
  type InboundEnquiryBrief,
  normalizeInboundEnquiryBrief,
} from "@/lib/contact/inboundIntentContract";
import { isJsonObject, type JsonObject, type JsonValue } from "@/lib/jsonValue";
import { isRuntimeString } from "@/lib/runtimeValues";

export const DESTINATION_PLAN_SCHEMA_VERSION = 2;
export const DESTINATION_PLAN_STORAGE_KEY = "citius:destination-plan";
export const DESTINATION_SHORTLIST_LIMIT = 3;

export interface DestinationPlanReference {
  id: string;
  name: string;
  region: PublicDestinationRegion;
}

export interface DestinationPlan {
  catalogVersion: typeof PUBLIC_DESTINATIONS_VERSION;
  draft: InboundEnquiryBrief;
  schemaVersion: typeof DESTINATION_PLAN_SCHEMA_VERSION;
  shortlist: DestinationPlanReference[];
}

export type DestinationPlanReadResult =
  | { plan: DestinationPlan; status: "empty" | "migrated" | "ready" }
  | { status: "catalog-drift" | "invalid" };

export type DestinationPlanHandoffResult =
  | { brief: InboundEnquiryBrief; ok: true }
  | { ok: false; reason: "catalog-drift" | "invalid" };

interface DestinationPlanStorage {
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
}

const CURRENT_PLAN_FIELDS = new Set(["catalogVersion", "draft", "schemaVersion", "shortlist"]);
const LEGACY_PLAN_FIELDS = new Set(["catalogVersion", "destinationIds", "draft", "schemaVersion"]);
const REFERENCE_FIELDS = new Set(["id", "name", "region"]);
const destinationById = new Map<string, PublicDestination>(
  PUBLIC_DESTINATIONS.map((destination) => [destination.id, destination])
);

function hasExactFields(value: JsonObject, fields: ReadonlySet<string>) {
  const keys = Object.keys(value);
  return keys.length === fields.size && keys.every((key) => fields.has(key));
}

function canonicalReference(destination: PublicDestination): DestinationPlanReference {
  return {
    id: destination.id,
    name: destination.name,
    region: destination.region,
  };
}

export function createEmptyDestinationPlan(): DestinationPlan {
  return {
    catalogVersion: PUBLIC_DESTINATIONS_VERSION,
    draft: {},
    schemaVersion: DESTINATION_PLAN_SCHEMA_VERSION,
    shortlist: [],
  };
}

function normalizeDraft(value: JsonValue) {
  const result = normalizeInboundEnquiryBrief(value);
  if (!result.ok) {
    return null;
  }
  return result.value ?? {};
}

function resolveReference(value: JsonValue): DestinationPlanReference | null {
  if (!(isJsonObject(value) && hasExactFields(value, REFERENCE_FIELDS))) {
    return null;
  }
  const { id, name, region } = value;
  if (
    !(
      isRuntimeString(id) &&
      isRuntimeString(name) &&
      (region === "domestic" || region === "international")
    )
  ) {
    return null;
  }
  const destination = destinationById.get(id);
  if (!(destination && destination.name === name && destination.region === region)) {
    return null;
  }
  return canonicalReference(destination);
}

function resolveShortlist(value: JsonValue): DestinationPlanReference[] | null {
  if (!(Array.isArray(value) && value.length <= DESTINATION_SHORTLIST_LIMIT)) {
    return null;
  }
  const resolved: DestinationPlanReference[] = [];
  for (const storedReference of value) {
    const reference = resolveReference(storedReference);
    if (!reference) {
      return null;
    }
    resolved.push(reference);
  }
  return new Set(resolved.map(({ id }) => id)).size === resolved.length ? resolved : null;
}

function resolveLegacyShortlist(value: JsonValue): DestinationPlanReference[] | null {
  if (!(Array.isArray(value) && value.length <= DESTINATION_SHORTLIST_LIMIT)) {
    return null;
  }
  const resolved: DestinationPlanReference[] = [];
  const destinationIds = new Set<string>();
  for (const destinationId of value) {
    if (!isRuntimeString(destinationId)) {
      return null;
    }
    const destination = destinationById.get(destinationId);
    if (!(destination && !destinationIds.has(destinationId))) {
      return null;
    }
    destinationIds.add(destinationId);
    resolved.push(canonicalReference(destination));
  }
  return resolved;
}

function parseCurrentPlan(value: JsonObject): DestinationPlanReadResult {
  if (!hasExactFields(value, CURRENT_PLAN_FIELDS)) {
    return { status: "invalid" };
  }
  if (value.catalogVersion !== PUBLIC_DESTINATIONS_VERSION) {
    return { status: "catalog-drift" };
  }
  const shortlist = resolveShortlist(value.shortlist);
  if (!shortlist) {
    return { status: "catalog-drift" };
  }
  const draft = normalizeDraft(value.draft);
  if (!draft) {
    return { status: "invalid" };
  }
  return {
    plan: {
      catalogVersion: PUBLIC_DESTINATIONS_VERSION,
      draft,
      schemaVersion: DESTINATION_PLAN_SCHEMA_VERSION,
      shortlist,
    },
    status: "ready",
  };
}

function parseLegacyPlan(value: JsonObject): DestinationPlanReadResult {
  if (!hasExactFields(value, LEGACY_PLAN_FIELDS)) {
    return { status: "invalid" };
  }
  if (value.catalogVersion !== PUBLIC_DESTINATIONS_VERSION) {
    return { status: "catalog-drift" };
  }
  const shortlist = resolveLegacyShortlist(value.destinationIds);
  if (!shortlist) {
    return { status: "catalog-drift" };
  }
  const draft = normalizeDraft(value.draft);
  if (!draft) {
    return { status: "invalid" };
  }
  return {
    plan: {
      catalogVersion: PUBLIC_DESTINATIONS_VERSION,
      draft,
      schemaVersion: DESTINATION_PLAN_SCHEMA_VERSION,
      shortlist,
    },
    status: "migrated",
  };
}

export function readDestinationPlan(raw: string | null): DestinationPlanReadResult {
  if (!raw) {
    return { plan: createEmptyDestinationPlan(), status: "empty" };
  }
  let parsed: JsonValue;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "invalid" };
  }
  if (!isJsonObject(parsed)) {
    return { status: "invalid" };
  }
  if (parsed.schemaVersion === DESTINATION_PLAN_SCHEMA_VERSION) {
    return parseCurrentPlan(parsed);
  }
  if (parsed.schemaVersion === 1) {
    return parseLegacyPlan(parsed);
  }
  return { status: "invalid" };
}

export function serializeDestinationPlan(plan: DestinationPlan) {
  const result = readDestinationPlan(JSON.stringify(plan));
  if (result.status !== "ready") {
    throw new Error("Destination plan is not safe to store.");
  }
  return JSON.stringify(result.plan);
}

export function saveDestinationPlan(storage: DestinationPlanStorage, plan: DestinationPlan) {
  storage.setItem(DESTINATION_PLAN_STORAGE_KEY, serializeDestinationPlan(plan));
}

export function resetDestinationPlan(storage: DestinationPlanStorage) {
  storage.removeItem(DESTINATION_PLAN_STORAGE_KEY);
}

function destinationPlanSummary(shortlist: readonly DestinationPlanReference[]) {
  return shortlist.map(({ name }) => name).join(", ");
}

export function addDestinationToPlan(
  plan: DestinationPlan,
  destinationId: string
): DestinationPlan {
  const destination = destinationById.get(destinationId);
  if (
    !destination ||
    plan.shortlist.some(({ id }) => id === destinationId) ||
    plan.shortlist.length >= DESTINATION_SHORTLIST_LIMIT
  ) {
    return plan;
  }
  const previousSummary = destinationPlanSummary(plan.shortlist);
  const shortlist = [...plan.shortlist, canonicalReference(destination)];
  const draft = { ...plan.draft };
  if (!draft.destination || draft.destination === previousSummary) {
    draft.destination = destinationPlanSummary(shortlist);
  }
  return { ...plan, draft, shortlist };
}

export function removeDestinationFromPlan(plan: DestinationPlan, destinationId: string) {
  const previousSummary = destinationPlanSummary(plan.shortlist);
  const shortlist = plan.shortlist.filter(({ id }) => id !== destinationId);
  const draft = { ...plan.draft };
  if (draft.destination === previousSummary) {
    draft.destination = destinationPlanSummary(shortlist);
  }
  return { ...plan, draft, shortlist };
}

export function moveDestinationInPlan(
  plan: DestinationPlan,
  destinationId: string,
  direction: -1 | 1
) {
  const currentIndex = plan.shortlist.findIndex(({ id }) => id === destinationId);
  const targetIndex = currentIndex + direction;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= plan.shortlist.length) {
    return plan;
  }
  const previousSummary = destinationPlanSummary(plan.shortlist);
  const shortlist = [...plan.shortlist];
  [shortlist[currentIndex], shortlist[targetIndex]] = [
    shortlist[targetIndex],
    shortlist[currentIndex],
  ];
  const draft = { ...plan.draft };
  if (draft.destination === previousSummary) {
    draft.destination = destinationPlanSummary(shortlist);
  }
  return { ...plan, draft, shortlist };
}

export function prepareDestinationPlanHandoff(plan: DestinationPlan): DestinationPlanHandoffResult {
  const result = readDestinationPlan(JSON.stringify(plan));
  if (!("plan" in result)) {
    return { ok: false, reason: result.status };
  }
  return { brief: result.plan.draft, ok: true };
}
