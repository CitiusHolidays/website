import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const loginSource = readFileSync(new URL("./AuthLoginCredentials.js", import.meta.url), "utf8");
const portalAuthBoundarySource = readFileSync(
  new URL("../../app/portal/PortalAuthBoundary.js", import.meta.url),
  "utf8"
);

test("Syncs the signed-in identity from the authenticated portal request, not the stale client token", () => {
  expect(loginSource).not.toContain("syncMyAuthIdentity");
  expect(loginSource).not.toContain("syncMyPortalAccess");
  // The portal syncs and reads access in one server call on the request's token.
  expect(portalAuthBoundarySource).toContain(
    "fetchAuthMutation(anyApi.authSync.syncMyPortalAccess, {}, authOptions)"
  );
});
