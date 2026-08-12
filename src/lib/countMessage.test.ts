import { describe, expect, test } from "bun:test";
import { formatCount } from "./countMessage";

describe("formatCount", () => {
  test.each([
    [0, "0 rows"],
    [1, "1 row"],
    [2, "2 rows"],
  ])("formats %i with complete row grammar", (count, expected) => {
    expect(formatCount(count, "row")).toBe(expected);
  });

  test("supports an explicit irregular plural", () => {
    expect(formatCount(1, "person", "people")).toBe("1 person");
    expect(formatCount(3, "person", "people")).toBe("3 people");
  });
});
