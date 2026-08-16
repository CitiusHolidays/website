import { httpRouter, makeFunctionReference } from "convex/server";
import { api, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./betterAuth/auth";
import { assertE2eTargetIdentity, assertProvidedE2eSecret } from "./crm/lib/e2eAuth";
import { enforcePortalFileDownloadLimit } from "./crm/lib/portalFileDownloadLimit";
import { CONVEX_E2E_DEPLOYMENT_SOURCE_HASH } from "./e2eDeploymentIdentity";
import { isRuntimeString } from "./lib/runtimeValues";

const http = httpRouter();

interface E2eRequestBody {
  runId: string;
  targetId: string;
}

interface UnparsedE2eRequestBody {
  runId?: unknown;
  targetId?: unknown;
}

const runE2eSeed = makeFunctionReference<"action", { runId: string; targetId: string }, unknown>(
  "crm/e2eSeedActions:run"
);
const cleanupE2eRun = makeFunctionReference<"action", { runId: string; targetId: string }, unknown>(
  "crm/e2eSeedActions:cleanup"
);

authComponent.registerRoutes(http, createAuth);

function e2eIdentityResponse(request: Request) {
  try {
    assertProvidedE2eSecret(request.headers.get("x-e2e-seed-secret"));
    const identity = assertE2eTargetIdentity(request.headers.get("x-e2e-target-id"));
    return Response.json(
      {
        convexSiteOrigin: new URL(request.url).origin,
        convexSourceHash: CONVEX_E2E_DEPLOYMENT_SOURCE_HASH,
        id: identity.targetId,
        target: identity.target,
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch {
    return new Response(null, { status: 404 });
  }
}

const e2eIdentity = httpAction((_ctx, request) => Promise.resolve(e2eIdentityResponse(request)));

const e2eSeed = httpAction(async (ctx, request) => {
  const secret = request.headers.get("x-e2e-seed-secret") ?? undefined;
  let body: E2eRequestBody;
  try {
    assertProvidedE2eSecret(secret);
    // SAFETY: The optional fields are validated as non-empty strings immediately below.
    const parsed = (await request.json()) as UnparsedE2eRequestBody;
    if (!(isRuntimeString(parsed.runId) && isRuntimeString(parsed.targetId))) {
      throw new Error("Missing run or target identity");
    }
    assertE2eTargetIdentity(parsed.targetId);
    body = { runId: parsed.runId, targetId: parsed.targetId };
  } catch {
    return Response.json({ error: "E2E seed is not authorized" }, { status: 401 });
  }
  try {
    const result = await ctx.runAction(runE2eSeed, {
      runId: body.runId,
      targetId: body.targetId,
    });
    return Response.json(result);
  } catch {
    return Response.json({ error: "E2E seed is temporarily unavailable" }, { status: 503 });
  }
});

const e2eCleanup = httpAction(async (ctx, request) => {
  const secret = request.headers.get("x-e2e-seed-secret") ?? undefined;
  let body: E2eRequestBody;
  try {
    assertProvidedE2eSecret(secret);
    // SAFETY: The optional fields are validated as non-empty strings immediately below.
    const parsed = (await request.json()) as UnparsedE2eRequestBody;
    if (!(isRuntimeString(parsed.runId) && isRuntimeString(parsed.targetId))) {
      throw new Error("Missing run or target identity");
    }
    assertE2eTargetIdentity(parsed.targetId);
    body = { runId: parsed.runId, targetId: parsed.targetId };
  } catch {
    return Response.json({ error: "E2E cleanup is not authorized" }, { status: 401 });
  }
  try {
    const result = await ctx.runAction(cleanupE2eRun, {
      runId: body.runId,
      targetId: body.targetId,
    });
    return Response.json(result);
  } catch {
    return Response.json({ error: "E2E cleanup is temporarily unavailable" }, { status: 503 });
  }
});

http.route({
  handler: e2eCleanup,
  method: "POST",
  path: "/e2e/cleanup",
});

http.route({
  handler: e2eIdentity,
  method: "GET",
  path: "/e2e/identity",
});

http.route({
  handler: e2eSeed,
  method: "POST",
  path: "/e2e/seed",
});

function safeDownloadFileName(value: string) {
  return (
    value
      .replace(/[\r\n\\"]/g, "_")
      .replace(/[^\w .,@()[\]-]/g, "_")
      .trim() || "passenger-export.xlsx"
  );
}

function privateJson(error: string, status: number) {
  return Response.json(
    { error },
    { headers: { "Cache-Control": "private, no-store, max-age=0" }, status }
  );
}

const passengerExportDownload = httpAction(async (ctx, request) => {
  const operationId = decodeURIComponent(new URL(request.url).pathname.split("/").pop() ?? "");
  if (!operationId) {
    return privateJson("Export operation not found", 404);
  }
  try {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess, {});
    if (!access?.allowed) {
      return privateJson("FORBIDDEN", 403);
    }
    await enforcePortalFileDownloadLimit(ctx, access);
    const operation = await ctx.runQuery(
      internal.crm.imports.getAuthorizedPassengerExportOperation,
      {
        access,
        operationId,
      }
    );
    if (
      operation.status !== "completed" ||
      !operation.storageId ||
      !operation.fileName ||
      !operation.expiresAt ||
      operation.expiresAt <= Date.now()
    ) {
      return privateJson("Export file is not ready", 404);
    }
    const blob = await ctx.storage.get(operation.storageId);
    if (!blob) {
      return privateJson("Export file is no longer available", 404);
    }
    const fileName = safeDownloadFileName(operation.fileName);
    return new Response(blob.stream(), {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Content-Length": String(blob.size),
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "X-Content-Type-Options": "nosniff",
      },
      status: 200,
    });
  } catch {
    console.error("Passenger export download rejected");
    return privateJson("Unable to access export", 403);
  }
});

http.route({
  handler: passengerExportDownload,
  method: "GET",
  pathPrefix: "/portal/exports/",
});

export default http;
