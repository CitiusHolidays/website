import { describe, expect, test } from "bun:test";
import { SACRED_BHARAT_EDITION_PATH, sacredBharatEditionHref } from "./editionHref";

describe("Sacred Bharat edition href", () => {
  test("serves the edition at the guest path and preserves share tokens", () => {
    expect(SACRED_BHARAT_EDITION_PATH).toBe("/sacred-bharat");
    expect(sacredBharatEditionHref("001")).toBe("/sacred-bharat/001");
    expect(sacredBharatEditionHref("001", { via: "0123456789abcdef0123456789abcdef" })).toBe(
      "/sacred-bharat/001?via=0123456789abcdef0123456789abcdef"
    );
  });
});
