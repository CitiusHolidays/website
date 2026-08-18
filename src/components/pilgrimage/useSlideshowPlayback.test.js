import { describe, expect, test } from "bun:test";
import { shouldAdvanceSlideshow } from "./useSlideshowPlayback";

describe("Slideshow playback policy", () => {
  test("Advances only when playback is requested, visible, and on screen", () => {
    const active = {
      inView: true,
      itemCount: 4,
      pageVisible: true,
      userWantsPlayback: true,
    };
    expect(shouldAdvanceSlideshow(active)).toBe(true);
    expect(shouldAdvanceSlideshow({ ...active, inView: false })).toBe(false);
    expect(shouldAdvanceSlideshow({ ...active, pageVisible: false })).toBe(false);
    expect(shouldAdvanceSlideshow({ ...active, userWantsPlayback: false })).toBe(false);
    expect(shouldAdvanceSlideshow({ ...active, itemCount: 1 })).toBe(false);
  });
});
