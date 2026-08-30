import { resolvePilgrimageTrailContactContext } from "@/data/trails";
import { isJsonObject, type JsonValue } from "@/lib/jsonValue";
import {
  type ContactIntent,
  type PilgrimageTrailContactContext,
  resolveContactIntent,
} from "@/lib/public/contactIntent";
import { isRuntimeString } from "@/lib/runtimeValues";
import type { WebsiteSourceContext } from "./inboundIntentContract";

const WEBSITE_SOURCE_INPUT_FIELDS = new Set(["intent", "trailSlug"]);

interface WebsiteSourceContextInput {
  intent: WebsiteSourceContext["intent"];
  trailSlug?: string;
}

function sourceLabel(intent: ContactIntent, trail: PilgrimageTrailContactContext | null) {
  if (trail) {
    return intent === "pilgrimage-callback" ? `${trail.title} callback` : `${trail.title} enquiry`;
  }
  switch (intent) {
    case "account-deletion":
      return "Account deletion request";
    case "mice-proposal":
      return "MICE proposal request";
    case "pilgrimage-callback":
      return "Pilgrimage callback request";
    case "pilgrimage-enquiry":
      return "Pilgrimage programme enquiry";
    default:
      return "Website enquiry";
  }
}

export function createWebsiteSourceContext(
  intent: ContactIntent | null,
  trail: PilgrimageTrailContactContext | null = null
): WebsiteSourceContext | undefined {
  if (!intent) {
    return;
  }
  const context: WebsiteSourceContext = {
    intent,
    label: sourceLabel(intent, trail),
  };
  if (trail) {
    context.trailSlug = trail.slug;
  }
  return context;
}

export function websiteSourceContextInput(context: WebsiteSourceContext | undefined) {
  if (!context) {
    return;
  }
  const input: WebsiteSourceContextInput = {
    intent: context.intent,
  };
  if (context.trailSlug) {
    input.trailSlug = context.trailSlug;
  }
  return input;
}

export function resolveWebsiteSourceContext(
  value: JsonValue
): { error: string; ok: false } | { ok: true; value?: WebsiteSourceContext } {
  if (value === undefined || value === null) {
    return { ok: true };
  }
  if (!isJsonObject(value)) {
    return { error: "Invalid website enquiry source.", ok: false };
  }
  if (Object.keys(value).some((field) => !WEBSITE_SOURCE_INPUT_FIELDS.has(field))) {
    return { error: "Invalid website enquiry source.", ok: false };
  }
  const intent = resolveContactIntent(value.intent);
  if (!intent) {
    return { error: "Invalid website enquiry source.", ok: false };
  }

  const rawTrailSlug = value.trailSlug;
  const isPilgrimage = intent === "pilgrimage-callback" || intent === "pilgrimage-enquiry";
  if (!isPilgrimage && rawTrailSlug !== undefined) {
    return { error: "Invalid website enquiry source.", ok: false };
  }
  if (rawTrailSlug !== undefined && !isRuntimeString(rawTrailSlug)) {
    return { error: "Invalid website enquiry source.", ok: false };
  }
  const trail = rawTrailSlug ? resolvePilgrimageTrailContactContext(rawTrailSlug) : null;
  if (rawTrailSlug && !trail) {
    return { error: "Select a valid pilgrimage programme.", ok: false };
  }
  return { ok: true, value: createWebsiteSourceContext(intent, trail) };
}
