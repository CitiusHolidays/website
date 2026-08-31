import { describe, expect, test } from "bun:test";
import { commercialFileUrl } from "./commercialFileRoutes";

describe("Commercial File routes", () => {
  test("keeps opaque canonical ids encoded on the authenticated same-origin route", () => {
    expect(commercialFileUrl("commercial/file id")).toBe(
      "/api/portal/files/commercial/commercial%2Ffile%20id"
    );
  });
});
