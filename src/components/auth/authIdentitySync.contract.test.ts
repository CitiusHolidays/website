import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const loginSource = readFileSync(new URL("./AuthLoginCredentials.js", import.meta.url), "utf8");
const portalLayoutSource = readFileSync(
  new URL("../../app/portal/layout.js", import.meta.url),
  "utf8"
);

test("syncs the signed-in identity from the authenticated portal request, not the stale client token", () => {
  expect(loginSource).not.toContain("syncMyAuthIdentity");
  expect(portalLayoutSource).toContain("fetchAuthMutation(anyApi.authSync.syncMyAuthIdentity, {})");
});
