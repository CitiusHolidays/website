// Shared by the Convex delivery boundary and the Next proxy so rejected images
// can never be recorded as successful preview views.
const MAX_IMAGE_DIMENSION = 20_000;
const MAX_IMAGE_FRAMES = 100;
const MAX_IMAGE_PIXELS = 25_000_000;
const MAX_IMAGE_FRAME_PIXELS = 50_000_000;

interface ImageDimensions {
  framePixels: number;
  frames: number;
  height: number;
  width: number;
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function pngDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 24) {
    return null;
  }
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (
    bytes.length < pngSignature.length ||
    !pngSignature.every((value, index) => bytes[index] === value)
  ) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let frames = 1;
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset, false);
    if (offset + 12 + length > bytes.length) {
      throw new Error("PNG chunk exceeds the source bounds");
    }
    if (ascii(bytes, offset + 4, 4) === "acTL" && length >= 4) {
      frames = view.getUint32(offset + 8, false);
    }
    offset += 12 + length;
  }
  return {
    framePixels: frames * view.getUint32(20, false) * view.getUint32(16, false),
    frames,
    height: view.getUint32(20, false),
    width: view.getUint32(16, false),
  };
}

function skipGifSubBlocks(bytes: Uint8Array, start: number) {
  let offset = start;
  while (offset < bytes.length) {
    const length = bytes[offset];
    offset += 1;
    if (length === 0) {
      return offset;
    }
    if (offset + length > bytes.length) {
      throw new Error("GIF data block exceeds the source bounds");
    }
    offset += length;
  }
  throw new Error("GIF data block is incomplete");
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the bounded GIF block parser validates every descriptor while advancing one cursor.
function gifDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 13 || !["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6))) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);
  // biome-ignore lint/style/useDestructuring: byte 10 is a named binary-format offset, not an array collection element.
  const packed = bytes[10];
  let offset = 13;
  if (packed >= 0x80) {
    offset += 3 * 2 ** ((packed % 8) + 1);
  }
  let frames = 0;
  let framePixels = 0;
  while (offset < bytes.length) {
    const marker = bytes[offset];
    if (marker === 0x3b) {
      break;
    }
    if (marker === 0x21) {
      if (offset + 2 > bytes.length) {
        throw new Error("GIF extension is incomplete");
      }
      offset = skipGifSubBlocks(bytes, offset + 2);
      continue;
    }
    if (marker === 0x2c) {
      if (offset + 10 > bytes.length) {
        throw new Error("GIF frame descriptor is incomplete");
      }
      const left = view.getUint16(offset + 1, true);
      const top = view.getUint16(offset + 3, true);
      const frameWidth = view.getUint16(offset + 5, true);
      const frameHeight = view.getUint16(offset + 7, true);
      const framePacked = bytes[offset + 9];
      if (
        frameWidth < 1 ||
        frameHeight < 1 ||
        left + frameWidth > width ||
        top + frameHeight > height
      ) {
        throw new Error("GIF frame exceeds the logical screen bounds");
      }
      frames += 1;
      framePixels += frameWidth * frameHeight;
      offset += 10;
      if (framePacked >= 0x80) {
        offset += 3 * 2 ** ((framePacked % 8) + 1);
      }
      if (offset >= bytes.length) {
        throw new Error("GIF frame data is missing");
      }
      offset = skipGifSubBlocks(bytes, offset + 1);
      continue;
    }
    throw new Error("GIF block marker is invalid");
  }
  return {
    framePixels: Math.max(width * height, framePixels),
    frames: Math.max(1, frames),
    height,
    width,
  };
}

function jpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let offset = 2;
  while (offset + 9 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = view.getUint16(offset + 2, false);
    if (length < 2 || offset + 2 + length > bytes.length) {
      throw new Error("JPEG segment exceeds the source bounds");
    }
    if (startOfFrameMarkers.has(marker)) {
      return {
        framePixels: view.getUint16(offset + 5, false) * view.getUint16(offset + 7, false),
        frames: 1,
        height: view.getUint16(offset + 5, false),
        width: view.getUint16(offset + 7, false),
      };
    }
    offset += 2 + length;
  }
  throw new Error("JPEG dimensions are missing");
}

function webpDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let dimensions: Omit<ImageDimensions, "frames"> | null = null;
  let frames = 0;
  let animatedFramePixels = 0;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const kind = ascii(bytes, offset, 4);
    const length = view.getUint32(offset + 4, true);
    const payload = offset + 8;
    if (payload + length > bytes.length) {
      throw new Error("WebP chunk exceeds the source bounds");
    }
    if (kind === "VP8X" && length >= 10) {
      dimensions = {
        framePixels: 0,
        height: 1 + bytes[payload + 7] + bytes[payload + 8] * 256 + bytes[payload + 9] * 65_536,
        width: 1 + bytes[payload + 4] + bytes[payload + 5] * 256 + bytes[payload + 6] * 65_536,
      };
    } else if (kind === "VP8 " && length >= 10) {
      dimensions = {
        framePixels: 0,
        height: view.getUint16(payload + 8, true) % 16_384,
        width: view.getUint16(payload + 6, true) % 16_384,
      };
    } else if (kind === "VP8L" && length >= 5 && bytes[payload] === 0x2f) {
      const bits = view.getUint32(payload + 1, true);
      dimensions = {
        framePixels: 0,
        height: 1 + (Math.floor(bits / 16_384) % 16_384),
        width: 1 + (bits % 16_384),
      };
    } else if (kind === "ANMF" && length >= 16) {
      const frameWidth =
        1 + bytes[payload + 6] + bytes[payload + 7] * 256 + bytes[payload + 8] * 65_536;
      const frameHeight =
        1 + bytes[payload + 9] + bytes[payload + 10] * 256 + bytes[payload + 11] * 65_536;
      frames += 1;
      animatedFramePixels += frameWidth * frameHeight;
    }
    offset = payload + length + (length % 2);
  }
  if (!dimensions) {
    throw new Error("WebP dimensions are missing");
  }
  return {
    ...dimensions,
    framePixels: Math.max(dimensions.width * dimensions.height, animatedFramePixels),
    frames: Math.max(1, frames),
  };
}

export function assertSafeImagePreview(input: ArrayBuffer, mimeType: string) {
  const bytes = new Uint8Array(input);
  const png = pngDimensions(bytes);
  const gif = png ? null : gifDimensions(bytes);
  const jpeg = png || gif ? null : jpegDimensions(bytes);
  const webp = png || gif || jpeg ? null : webpDimensions(bytes);
  const dimensions = png ?? gif ?? jpeg ?? webp;
  if (!dimensions) {
    throw new Error("Image signature is unsupported");
  }
  const normalizedMime = mimeType.split(";", 1)[0].trim().toLowerCase();
  let expectedMime = "image/webp";
  if (png) {
    expectedMime = "image/png";
  } else if (gif) {
    expectedMime = "image/gif";
  } else if (jpeg) {
    expectedMime = "image/jpeg";
  }
  if (normalizedMime !== expectedMime) {
    throw new Error("Image signature does not match its content type");
  }
  if (
    dimensions.width < 1 ||
    dimensions.height < 1 ||
    dimensions.width > MAX_IMAGE_DIMENSION ||
    dimensions.height > MAX_IMAGE_DIMENSION ||
    dimensions.width * dimensions.height > MAX_IMAGE_PIXELS ||
    dimensions.frames > MAX_IMAGE_FRAMES ||
    dimensions.framePixels > MAX_IMAGE_FRAME_PIXELS
  ) {
    throw new Error("Image exceeds safe decoded dimensions or frame limits");
  }
  return dimensions;
}
