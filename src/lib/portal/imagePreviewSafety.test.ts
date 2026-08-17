import { describe, expect, test } from "bun:test";
import { assertSafeImagePreview } from "@convex/crm/lib/documentPreviewImageSafety";

function png(width: number, height: number) {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13, false);
  bytes.set([73, 72, 68, 82], 12);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes.buffer;
}

function animatedPng(width: number, height: number, frames: number) {
  const bytes = new Uint8Array(53);
  bytes.set(new Uint8Array(png(width, height)));
  const view = new DataView(bytes.buffer);
  view.setUint32(33, 8, false);
  bytes.set([97, 99, 84, 76], 37);
  view.setUint32(41, frames, false);
  return bytes.buffer;
}

describe("image preview safety", () => {
  test("accepts a bounded raster image with a matching signature", () => {
    expect(assertSafeImagePreview(png(1200, 800), "image/png")).toEqual({
      framePixels: 960_000,
      frames: 1,
      height: 800,
      width: 1200,
    });
  });

  test("rejects decoded-pixel bombs and signature mismatches", () => {
    expect(() => assertSafeImagePreview(png(20_000, 20_000), "image/png")).toThrow(
      "decoded dimensions"
    );
    expect(() => assertSafeImagePreview(png(100, 100), "image/jpeg")).toThrow("does not match");
    expect(() => assertSafeImagePreview(animatedPng(1000, 1000, 100), "image/png")).toThrow(
      "frame limits"
    );
  });

  test("rejects a GIF frame outside its logical screen", () => {
    const bytes = new Uint8Array(23);
    bytes.set(new TextEncoder().encode("GIF89a"));
    const view = new DataView(bytes.buffer);
    view.setUint16(6, 10, true);
    view.setUint16(8, 10, true);
    bytes[13] = 0x2c;
    view.setUint16(18, 11, true);
    view.setUint16(20, 1, true);
    expect(() => assertSafeImagePreview(bytes.buffer, "image/gif")).toThrow(
      "logical screen bounds"
    );
  });
});
