import { anyApi } from "convex/server";
import { fetchAuthMutation, getToken } from "@/lib/auth-server";
import { isJsonObject, type JsonValue } from "@/lib/jsonValue";
import { withApiRequestLogging } from "@/lib/observability/api-log";
import { isRuntimeString } from "@/lib/runtimeValues";

const CONFIRMED_OFFER_ID = /^[A-Za-z0-9_-]{1,128}$/;
const MILESTONES = new Set(["arrival_pack_ready", "confirmed_travel_summary_ready"]);
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
} as const;

function privateJson(payload: JsonValue, status = 200) {
  return Response.json(payload, { headers: PRIVATE_HEADERS, status });
}

function validMilestones(value: JsonValue): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= MILESTONES.size &&
    value.every((milestone) => isRuntimeString(milestone) && MILESTONES.has(milestone)) &&
    new Set(value).size === value.length
  );
}

async function handleReminderPreferences(
  request: Request,
  { params }: { params: Promise<{ confirmedOfferId: string }> }
) {
  try {
    const token = await getToken();
    if (!token) {
      return privateJson({ error: "Authentication required" }, 401);
    }
    const { confirmedOfferId } = await params;
    if (!CONFIRMED_OFFER_ID.test(confirmedOfferId)) {
      return privateJson({ error: "Journey not found" }, 404);
    }
    let body: JsonValue;
    try {
      body = await request.json();
    } catch {
      return privateJson({ error: "Invalid reminder choices" }, 400);
    }
    if (!(isJsonObject(body) && validMilestones(body.milestones))) {
      return privateJson({ error: "Invalid reminder choices" }, 400);
    }
    const reminders = await fetchAuthMutation(
      anyApi.customerJourneyReminders.setMyJourneyReminderPreferences,
      { confirmedOfferId, milestones: body.milestones },
      { token }
    );
    return privateJson({ reminders });
  } catch {
    return privateJson({ error: "Reminder choices could not be saved. Please try again." }, 400);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ confirmedOfferId: string }> }
) {
  return await withApiRequestLogging(
    request,
    "/api/account/reminder-preferences/[confirmedOfferId]",
    () => handleReminderPreferences(request, context)
  );
}
