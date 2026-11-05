import { api } from "@convex/_generated/api";
import { fetchMutation } from "convex/nextjs";
import { ConvexError } from "convex/values";
import { fetchConvexTokenFromHeaders } from "@/lib/auth-server";
import { isAllowedSiteOrigin } from "@/lib/contact/spam-guard";
import { readJsonBodyWithinLimit } from "@/lib/http/readJsonBody";
import {
  OFFICE_CHECK_IN_BODY_LIMIT_BYTES,
  type OfficeCheckInErrorCode,
  type OfficeCheckInResponse,
  parseOfficeCheckInRequest,
} from "./contracts";

type Env = Record<string, string | undefined>;

const MAX_CLIENT_IP_LENGTH = 64;

/**
 * The only client-IP source the check-in route trusts. Returns null (recorded
 * server-side as "IP unavailable", an uncertain signal) unless the deployment
 * explicitly opts in with OFFICE_CHECK_IN_CLIENT_IP_SOURCE=vercel-edge.
 *
 * Why opt-in: Vercel overwrites X-Forwarded-For with the connecting client IP
 * and drops any client-supplied value, so on a direct Vercel edge it is
 * trustworthy. Behind another proxy or CDN it would hold that proxy's IP
 * instead, and the repository does not record whether one sits in front of the
 * custom domain (RELEASE.md, domain/edge notes). Until an operator confirms the
 * edge path, the safe answer is "unknown", never a guessed or spoofable value.
 * The browser body is never an IP source.
 */
export function trustedClientIp(request: Request, env: Env = process.env): string | null {
  if (env.OFFICE_CHECK_IN_CLIENT_IP_SOURCE?.trim() !== "vercel-edge") {
    return null;
  }
  const value = request.headers.get("x-forwarded-for")?.trim() ?? "";
  if (!value || value.length > MAX_CLIENT_IP_LENGTH || value.includes(",")) {
    return null;
  }
  return value;
}

const FAILURES = {
  ALREADY_CLOCKED_OUT: { error: "You have already clocked out today.", status: 409 },
  FORBIDDEN: { error: "You do not have access to office check-in.", status: 403 },
  INVALID_REQUEST: { error: "Invalid check-in request.", status: 400 },
  NO_OFFICE_ASSIGNED: {
    error: "No office is assigned to your profile. Ask an administrator.",
    status: 409,
  },
  NO_STAFF_PROFILE: { error: "No active staff profile is linked to this account.", status: 403 },
  NOT_CLOCKED_IN: { error: "You are not clocked in.", status: 409 },
  OFFICE_INACTIVE: { error: "Your assigned office is inactive.", status: 409 },
  UNAUTHENTICATED: { error: "Sign in to clock in or out.", status: 401 },
  UNAVAILABLE: { error: "Check-in is unavailable. Try again shortly.", status: 503 },
} satisfies Record<OfficeCheckInErrorCode, { error: string; status: number }>;

/** Convex error codes the gateway mutations raise that are safe to surface. */
const CONVEX_CODES: readonly OfficeCheckInErrorCode[] = [
  "ALREADY_CLOCKED_OUT",
  "FORBIDDEN",
  "NO_OFFICE_ASSIGNED",
  "NO_STAFF_PROFILE",
  "NOT_CLOCKED_IN",
  "OFFICE_INACTIVE",
];

function respond(body: OfficeCheckInResponse, status: number) {
  return Response.json(body, { headers: { "Cache-Control": "no-store" }, status });
}

function failure(code: OfficeCheckInErrorCode, status = FAILURES[code].status) {
  return respond({ code, error: FAILURES[code].error, ok: false }, status);
}

interface OfficeCheckInDeps {
  env?: Env;
  send?: typeof fetchMutation;
  tokenFor?: typeof fetchConvexTokenFromHeaders;
}

export async function handleOfficeCheckIn(
  request: Request,
  {
    env = process.env,
    send = fetchMutation,
    tokenFor = fetchConvexTokenFromHeaders,
  }: OfficeCheckInDeps = {}
) {
  if (!isAllowedSiteOrigin(request)) {
    return failure("FORBIDDEN");
  }
  const gatewaySecret = env.OFFICE_CHECK_IN_GATEWAY_SECRET?.trim();
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!(gatewaySecret && url)) {
    return failure("UNAVAILABLE");
  }
  const result = await readJsonBodyWithinLimit(request, OFFICE_CHECK_IN_BODY_LIMIT_BYTES);
  if ("reason" in result && result.reason === "too_large") {
    return failure("INVALID_REQUEST", 413);
  }
  const body = result.ok && "value" in result ? parseOfficeCheckInRequest(result.value) : null;
  if (!body) {
    return failure("INVALID_REQUEST");
  }
  let token: string | null | undefined;
  try {
    token = await tokenFor(request.headers);
  } catch {
    return failure("UNAVAILABLE");
  }
  if (!token) {
    return failure("UNAUTHENTICATED");
  }
  const args = {
    gatewaySecret,
    location: body.location,
    observedIp: trustedClientIp(request, env),
  };
  try {
    if (body.action === "clock_in") {
      const { replayed } = await send(api.crm.officeCheckIns.clockInViaGateway, args, {
        token,
        url,
      });
      return respond({ ok: true, replayed }, 200);
    }
    const { replayed } = await send(api.crm.officeCheckIns.clockOutViaGateway, args, {
      token,
      url,
    });
    return respond({ ok: true, replayed }, 200);
  } catch (error) {
    // Only known string codes are surfaced; anything else stays opaque.
    const code =
      error instanceof ConvexError ? CONVEX_CODES.find((known) => known === error.data) : undefined;
    return failure(code ?? "UNAVAILABLE");
  }
}
