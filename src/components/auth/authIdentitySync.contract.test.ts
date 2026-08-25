import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const loginSource = readFileSync(new URL("./AuthLoginCredentials.js", import.meta.url), "utf8");
const portalAuthBoundarySource = readFileSync(
  new URL("../../app/portal/PortalAuthBoundary.js", import.meta.url),
  "utf8"
);

test("Syncs the signed-in identity from the authenticated portal request, not the stale client token", () => {
  expect(loginSource).not.toContain("syncMyAuthIdentity");
  expect(portalAuthBoundarySource).toContain(
    "fetchAuthMutation(anyApi.authSync.syncMyAuthIdentity, {}, authOptions)"
  );
});
