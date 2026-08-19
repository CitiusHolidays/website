import { describe, expect, it } from "bun:test";
import { deriveEditionResult, getShareStyle } from "./editionResult";

const questions = [
  { id: "varanasi", location: "Varanasi", region: "north", theme: "river" },
  { id: "amritsar", location: "Amritsar", region: "north", theme: "architecture" },
  { id: "madurai", location: "Madurai", region: "south", theme: "architecture" },
  { id: "kedarnath", location: "Kedarnath", region: "north", theme: "architecture" },
  { id: "konark", location: "Konark", region: "east", theme: "architecture" },
];

describe("deriveEditionResult", () => {
  it("keeps the score factual while making a perfect result personal", () => {
    const result = deriveEditionResult(
      questions,
      Object.fromEntries(questions.map(({ id }) => [id, true]))
    );

    expect(result.score).toBe(5);
    expect(result.title).toBe("Every detail");
    expect(result.insight).toContain("every corner");
    expect(result.missedLocations).toEqual([]);
  });

  it("uses what someone recognised instead of implying spiritual rank", () => {
    const result = deriveEditionResult(questions, {
      amritsar: true,
      kedarnath: true,
      konark: true,
      madurai: true,
      varanasi: false,
    });

    expect(result.score).toBe(4);
    expect(result.title).toBe("Almost unmissable");
    expect(result.insight).toContain("Stone and skyline");
    expect(result.detail).toBe("Varanasi got you this time.");
  });

  it("returns a warm curiosity-led result when no answer is correct", () => {
    const result = deriveEditionResult(questions, {});

    expect(result.score).toBe(0);
    expect(result.title).toBe("A first glimpse");
    expect(result.insight).toContain("five new details");
  });
});

describe("getShareStyle", () => {
  it("cycles deterministically through all three approved story treatments", () => {
    expect(getShareStyle(-1).id).toBe("monsoon");
    expect(getShareStyle(0).id).toBe("archive");
    expect(getShareStyle(1).id).toBe("temple-red");
    expect(getShareStyle(2).id).toBe("monsoon");
    expect(getShareStyle(3).id).toBe("archive");
  });
});
