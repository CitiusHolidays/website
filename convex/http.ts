import { httpRouter } from "convex/server";
import { api, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./betterAuth/auth";
import { assertProvidedE2eSecret } from "./crm/lib/e2eAuth";
import { enforcePortalFileDownloadLimit } from "./crm/lib/portalFileDownloadLimit";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

const e2eSeed = httpAction(async (ctx, request) => {
  const secret = request.headers.get("x-e2e-seed-secret") ?? undefined;
  try {
    assertProvidedE2eSecret(secret);
    const result = await ctx.runAction(internal.crm.e2eSeedActions.run, {});
    return Response.json(result);
  } catch {
    return Response.json({ error: "E2E seed is not authorized" }, { status: 401 });
  }
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
