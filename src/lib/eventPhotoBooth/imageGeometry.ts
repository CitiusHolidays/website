export type BoothFormat = "portrait" | "story";
export interface BoothTransform {
  scale: number;
  /** Offset as a fraction of the output width/height, relative to automatic placement. */
  x: number;
  y: number;
}
export interface ImageBounds {
  height: number;
  width: number;
  x: number;
  y: number;
}
export const DEFAULT_TRANSFORM: BoothTransform = { scale: 1, x: 0, y: 0 };
export const EXPORT_DIMENSIONS = {
  portrait: { height: 1350, width: 1080 },
  story: { height: 1920, width: 1080 },
};

export function boundWorkingSize(width: number, height: number) {
  const scale = Math.min(1, 1600 / Math.max(width, height));
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

export function clampTransform(transform: BoothTransform): BoothTransform {
  return {
    scale: Number.isFinite(transform.scale) ? Math.max(0.35, Math.min(2.5, transform.scale)) : 1,
    x: Number.isFinite(transform.x) ? Math.max(-0.65, Math.min(0.65, transform.x)) : 0,
    y: Number.isFinite(transform.y) ? Math.max(-0.65, Math.min(0.65, transform.y)) : 0,
  };
}

export function placeCutout(
  bounds: ImageBounds,
  format: BoothFormat,
  transform = DEFAULT_TRANSFORM
) {
  const output = EXPORT_DIMENSIONS[format];
  const adjusted = clampTransform(transform);
  const scale =
    Math.min((output.width * 0.84) / bounds.width, (output.height * 0.6) / bounds.height) *
    adjusted.scale;
  return {
    scale,
    x: (output.width - bounds.width * scale) / 2 - bounds.x * scale + adjusted.x * output.width,
    y: output.height - 190 - (bounds.y + bounds.height) * scale + adjusted.y * output.height,
  };
}

export function coverCrop(
  width: number,
  height: number,
  targetWidth: number,
  targetHeight: number
) {
  const scale = Math.max(targetWidth / width, targetHeight / height);
  // Top alignment protects the Eiffel Tower and Burj Khalifa in the approved master scenes.
  return {
    height: targetHeight / scale,
    width: targetWidth / scale,
    x: (width - targetWidth / scale) / 2,
    y: 0,
  };
}

export function maskBounds(alpha: Uint8ClampedArray, width: number, height: number): ImageBounds {
  if (alpha.length !== width * height || width < 1 || height < 1) {
    throw new Error("Invalid cutout mask.");
  }
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alpha[y * width + x] < 128) {
        continue;
      }
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) {
    throw new Error(
      "No clear person was found. Try another photo or choose the whole-photo frame."
    );
  }
  return { height: bottom - top + 1, width: right - left + 1, x: left, y: top };
}
