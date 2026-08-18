import { describe, expect, test } from "bun:test";
import { findPdfSearchMatches, stepPdfSearchMatch } from "./pdfSearch";

describe("PDF search results", () => {
  test("Tracks every occurrence across PDF text runs", () => {
    expect(
      findPdfSearchMatches(
        [{ str: "Nishit " }, { str: "Sharma nish" }, { str: "it" }, { str: " NISHIT" }],
        "nishit"
      )
    ).toEqual([
      {
        begin: { itemIndex: 0, offset: 0 },
        end: { itemIndex: 0, offset: 6 },
      },
      {
        begin: { itemIndex: 1, offset: 7 },
        end: { itemIndex: 2, offset: 2 },
      },
      {
        begin: { itemIndex: 3, offset: 1 },
        end: { itemIndex: 3, offset: 7 },
      },
    ]);
  });

  test("Keeps line endings from creating false cross-line matches", () => {
    expect(findPdfSearchMatches([{ hasEOL: true, str: "nish" }, { str: "it" }], "nishit")).toEqual(
      []
    );
  });

  test("Moves through individual results and wraps in either direction", () => {
    expect(stepPdfSearchMatch(0, 3, 1)).toBe(1);
    expect(stepPdfSearchMatch(2, 3, 1)).toBe(0);
    expect(stepPdfSearchMatch(0, 3, -1)).toBe(2);
    expect(stepPdfSearchMatch(-1, 0, 1)).toBe(-1);
  });
});
