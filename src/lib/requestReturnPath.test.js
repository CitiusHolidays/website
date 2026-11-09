import { describe, expect, test } from "bun:test";
import { RETURN_PATH_HEADER, withReturnPathHeader } from "./requestReturnPath";

describe("Requested path hand-off", () => {
  test("Copies the path and query, and drops Next's own markers", () => {
    const headers = withReturnPathHeader(
      new Headers(),
      "https://travel.citius.in/portal/queries?status=lost&_rsc=abc123"
    );
    expect(headers.get(RETURN_PATH_HEADER)).toBe("/portal/queries?status=lost");
  });

  test("Replaces a value the client sent itself", () => {
    const headers = withReturnPathHeader(
      new Headers({ [RETURN_PATH_HEADER]: "//evil.example", cookie: "a=b" }),
      "https://travel.citius.in/portal"
    );
    expect(headers.get(RETURN_PATH_HEADER)).toBe("/portal");
    expect(headers.get("cookie")).toBe("a=b");
  });
});
