import { describe, expect, test } from "bun:test";
import { loadSourcePhoto, MAX_PHOTO_BYTES } from "./imageEngine";
import {
  boundWorkingSize,
  clampTransform,
  coverCrop,
  maskBounds,
  placeCutout,
} from "./imageGeometry";

describe("Booth photo safety and placement", () => {
  test("Rejects oversized or unsupported files before decoding", async () => {
    await expect(
      loadSourcePhoto(
        new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], "large.jpg", { type: "image/jpeg" })
      )
    ).rejects.toThrow("12 MB");
    await expect(
      loadSourcePhoto(new File(["<svg></svg>"], "bad.svg", { type: "image/svg+xml" }))
    ).rejects.toThrow("JPG");
    await expect(
      loadSourcePhoto(new File(["not a photograph"], "bad.jpg", { type: "image/jpeg" }))
    ).rejects.toThrow("signature");
  });
  test("Bounds working memory and top-anchors the scene crop", () => {
    expect(boundWorkingSize(4000, 3000)).toEqual({ height: 1200, width: 1600 });
    expect(boundWorkingSize(100, 200)).toEqual({ height: 200, width: 100 });
    expect(coverCrop(1024, 1536, 1080, 1350)).toEqual({ height: 1280, width: 1024, x: 0, y: 0 });
  });
  test("Uses all retained regions for placement and rejects an empty mask", () => {
    const alpha = new Uint8ClampedArray([0, 255, 0, 0, 0, 0, 255, 0, 0, 255, 0, 0]);
    const bounds = maskBounds(alpha, 4, 3);
    expect(bounds).toEqual({ height: 3, width: 2, x: 1, y: 0 });
    expect(() => maskBounds(new Uint8ClampedArray(12), 4, 3)).toThrow("No clear person");
    const placed = placeCutout(bounds, "portrait");
    expect(placed.y + (bounds.y + bounds.height) * placed.scale).toBe(1160);
    expect(clampTransform({ scale: -4, x: Number.NaN, y: Number.POSITIVE_INFINITY })).toEqual({
      scale: 0.35,
      x: 0,
      y: 0,
    });
  });
});
