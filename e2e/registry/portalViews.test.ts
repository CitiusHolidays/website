import { describe, expect, test } from "bun:test";
import { PORTAL_ROUTES } from "../../src/lib/portal/portalRouteManifest";
import { PORTAL_E2E_MATRIX } from "./portalViews";

describe("portal e2e registry", () => {
  test("covers every portal view id from the app registry export list", () => {
    expect(Object.keys(PORTAL_E2E_MATRIX).sort()).toEqual(Object.keys(PORTAL_ROUTES).sort());
  });
});
