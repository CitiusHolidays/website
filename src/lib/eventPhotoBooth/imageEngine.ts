import { assertSafeImagePreview } from "@convex/crm/lib/documentPreviewImageSafety";
import {
  type BoothFormat,
  type BoothTransform,
  boundWorkingSize,
  coverCrop,
  DEFAULT_TRANSFORM,
  EXPORT_DIMENSIONS,
  type ImageBounds,
  maskBounds,
  PHOTO_ACCEPT,
  placeCutout,
} from "./imageGeometry";

export interface BoothPhoto {
  canvas: HTMLCanvasElement;
  height: number;
  width: number;
}
export interface BoothCutout extends BoothPhoto {
  bounds: ImageBounds;
}
export interface PhotoLoadOptions {
  signal?: AbortSignal;
}
export interface CutoutOptions extends PhotoLoadOptions {
  onProgress?: (phase: "preparing" | "processing") => void;
}
interface WorkerResult {
  alpha?: Uint8ClampedArray;
  error?: string;
  height: number;
  id: number;
  phase?: "preparing" | "processing";
  width: number;
}
interface PendingCutout {
  cleanup: () => void;
  id: number;
  reject: (error: Error) => void;
}

export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

function contextFor(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("This browser cannot prepare a photo.");
  }
  return context;
}
function newCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}
export async function loadSourcePhoto(
  file: File,
  options: PhotoLoadOptions = {}
): Promise<BoothPhoto> {
  options.signal?.throwIfAborted();
  if (!file.size || file.size > MAX_PHOTO_BYTES) {
    throw new Error("Choose a photo smaller than 12 MB.");
  }
  if (!PHOTO_ACCEPT.split(",").includes(file.type)) {
    throw new Error("Choose a JPG, PNG or WebP photo.");
  }
  const bytes = await file.arrayBuffer();
  const dimensions = assertSafeImagePreview(bytes, file.type);
  if (dimensions.frames !== 1) {
    throw new Error("Choose a still photo, not an animation.");
  }
  options.signal?.throwIfAborted();
  const size = boundWorkingSize(dimensions.width, dimensions.height);
  // One resize dimension preserves EXIF-oriented aspect ratio. Using the shorter bound keeps either orientation below 1600px without a second EXIF parser.
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
    resizeQuality: "high",
    resizeWidth: Math.min(size.width, size.height),
  });
  try {
    options.signal?.throwIfAborted();
    const canvas = newCanvas(bitmap.width, bitmap.height);
    contextFor(canvas).drawImage(bitmap, 0, 0);
    return { canvas, height: canvas.height, width: canvas.width };
  } finally {
    bitmap.close();
  }
}
export function releaseBoothPhoto(photo: BoothPhoto | null | undefined) {
  if (photo) {
    photo.canvas.width = 0;
    photo.canvas.height = 0;
  }
}

function applyMask(
  photo: BoothPhoto,
  alpha: Uint8ClampedArray,
  width: number,
  height: number
): BoothCutout {
  const bounds = maskBounds(alpha, width, height);
  const mask = newCanvas(width, height);
  const pixels = contextFor(mask).createImageData(width, height);
  for (let i = 0; i < alpha.length; i += 1) {
    pixels.data[i * 4 + 3] = alpha[i];
  }
  contextFor(mask).putImageData(pixels, 0, 0);
  const canvas = newCanvas(photo.width, photo.height);
  const context = contextFor(canvas);
  context.drawImage(photo.canvas, 0, 0);
  context.globalCompositeOperation = "destination-in";
  context.drawImage(mask, 0, 0, photo.width, photo.height);
  mask.width = 0;
  mask.height = 0;
  return {
    bounds: {
      height: (bounds.height * photo.height) / height,
      width: (bounds.width * photo.width) / width,
      x: (bounds.x * photo.width) / width,
      y: (bounds.y * photo.height) / height,
    },
    canvas,
    height: photo.height,
    width: photo.width,
  };
}

/** One worker per active editor. The caller owns and releases returned photo canvases. */
export function createCutoutProcessor() {
  let worker: Worker | undefined;
  let sequence = 0;
  let pending: PendingCutout | undefined;
  function cancel(error: Error = new DOMException("Photo processing cancelled.", "AbortError")) {
    sequence += 1;
    worker?.terminate();
    worker = undefined;
    const previous = pending;
    pending = undefined;
    previous?.cleanup();
    previous?.reject(error);
  }
  async function segment(photo: BoothPhoto, options: CutoutOptions = {}): Promise<BoothCutout> {
    if (pending) {
      cancel();
    }
    sequence += 1;
    const id = sequence;
    options.signal?.throwIfAborted();
    if (!("Worker" in window && "OffscreenCanvas" in window)) {
      throw new Error("Cutouts are unavailable in this browser. Choose the whole-photo frame.");
    }
    const bitmap = await createImageBitmap(photo.canvas);
    if (id !== sequence || options.signal?.aborted) {
      bitmap.close();
      throw new DOMException("Photo processing cancelled.", "AbortError");
    }
    try {
      worker ??= new Worker("/photo-booth/cutout-worker.mjs", { type: "module" });
    } catch (error) {
      bitmap.close();
      throw error;
    }
    const activeWorker = worker;
    return new Promise((resolve, reject) => {
      const abort = () => cancel();
      const timer = window.setTimeout(() => {
        cancel(
          new Error(
            "Preparing the cutout took too long. Retry on a better connection or choose the whole-photo frame."
          )
        );
      }, 120_000);
      const cleanup = () => {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
      };
      pending = { cleanup, id, reject };
      options.signal?.addEventListener("abort", abort, { once: true });
      activeWorker.onmessage = (event: MessageEvent<WorkerResult>) => {
        const result = event.data;
        if (result.id !== id || sequence !== id) {
          return;
        }
        if (result.phase) {
          options.onProgress?.(result.phase);
          return;
        }
        cleanup();
        pending = undefined;
        if (result.error || !result.alpha) {
          reject(new Error(result.error || "The cutout could not be created."));
          return;
        }
        try {
          resolve(applyMask(photo, result.alpha, result.width, result.height));
        } catch (error) {
          reject(error);
        }
      };
      activeWorker.onerror = () => {
        cleanup();
        pending = undefined;
        worker?.terminate();
        worker = undefined;
        reject(new Error("The cutout could not be loaded. Retry or choose the whole-photo frame."));
      };
      activeWorker.postMessage({ bitmap, id }, [bitmap]);
    });
  }
  return { dispose: cancel, segment };
}

export function loadBoothArtwork(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    function cleanup() {
      signal?.removeEventListener("abort", abort);
      image.onload = null;
      image.onerror = null;
    }
    function abort() {
      cleanup();
      image.removeAttribute("src");
      reject(new DOMException("Artwork preparation cancelled.", "AbortError"));
    }
    if (signal?.aborted) {
      abort();
      return;
    }
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      cleanup();
      resolve(image);
    };
    image.onerror = () => {
      cleanup();
      reject(new Error("The destination artwork could not be loaded."));
    };
    signal?.addEventListener("abort", abort, { once: true });
    image.src = url;
  });
}
export function loadBoothLogo() {
  return loadBoothArtwork("/images/event-photo-booth/citius-logo.webp");
}

export interface RenderBoothOptions {
  artwork: HTMLImageElement;
  /** Reuse the same canvas for interaction previews. Export uses these exact pixels. */
  canvas?: HTMLCanvasElement;
  caption: string;
  cutout?: BoothCutout;
  format: BoothFormat;
  language: "en" | "hi";
  logo: HTMLImageElement;
  mode: "cutout" | "frame";
  photo?: BoothPhoto;
  title: string;
  transform?: BoothTransform;
}
function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  font: string,
  size: number,
  width: number
) {
  let fitted = size;
  context.font = `600 ${fitted}px ${font}`;
  while (fitted > 20 && context.measureText(text).width > width) {
    fitted -= 1;
    context.font = `600 ${fitted}px ${font}`;
  }
  return fitted;
}
export function renderBoothPhoto(options: RenderBoothOptions) {
  const { width, height } = EXPORT_DIMENSIONS[options.format];
  const canvas = options.canvas ?? newCanvas(width, height);
  canvas.width = width;
  canvas.height = height;
  const context = contextFor(canvas);
  const crop = coverCrop(
    options.artwork.naturalWidth,
    options.artwork.naturalHeight,
    width,
    height
  );
  context.drawImage(options.artwork, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
  if (options.mode === "cutout" && options.cutout) {
    const placed = placeCutout(
      options.cutout.bounds,
      options.format,
      options.transform ?? DEFAULT_TRANSFORM
    );
    context.drawImage(
      options.cutout.canvas,
      placed.x,
      placed.y,
      options.cutout.width * placed.scale,
      options.cutout.height * placed.scale
    );
  } else if (options.mode === "frame" && options.photo) {
    const { photo } = options;
    const scale = Math.min((width - 144) / photo.width, (height - 410) / photo.height);
    const frameWidth = photo.width * scale;
    const frameHeight = photo.height * scale;
    const x = (width - frameWidth) / 2;
    const y = (height - frameHeight) / 2;
    context.fillStyle = "#ffffff";
    context.fillRect(x - 16, y - 16, frameWidth + 32, frameHeight + 32);
    context.drawImage(photo.canvas, x, y, frameWidth, frameHeight);
  }
  const fade = context.createLinearGradient(0, height - 280, 0, height);
  fade.addColorStop(0, "rgba(11,16,38,0)");
  fade.addColorStop(0.5, "rgba(11,16,38,0.85)");
  fade.addColorStop(1, "#0b1026");
  context.fillStyle = fade;
  context.fillRect(0, height - 280, width, 280);
  context.fillStyle = "#ffffff";
  context.fillRect(38, 34, 234, 115);
  const logoScale = Math.min(206 / options.logo.naturalWidth, 91 / options.logo.naturalHeight);
  context.drawImage(
    options.logo,
    52 + (206 - options.logo.naturalWidth * logoScale) / 2,
    46 + (91 - options.logo.naturalHeight * logoScale) / 2,
    options.logo.naturalWidth * logoScale,
    options.logo.naturalHeight * logoScale
  );
  const styles = getComputedStyle(document.documentElement);
  const heading = styles.getPropertyValue("--font-poppins").trim() || "sans-serif";
  const body = styles.getPropertyValue("--font-inter").trim() || "sans-serif";
  context.fillStyle = "#ffffff";
  fitText(context, options.title, heading, 62, width - 112);
  context.fillText(options.title, 56, height - 130, width - 112);
  fitText(context, options.caption, body, 32, width - 112);
  context.fillText(options.caption, 56, height - 80, width - 112);
  context.font = `400 21px ${body}`;
  context.fillText(
    options.language === "hi" ? "Citius Holidays · फ़ोटो बूथ" : "Citius Holidays · Event Photo Booth",
    56,
    height - 36,
    width - 112
  );
  return canvas;
}
export function exportBoothPhoto(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Your photo could not be exported. Please try again.")),
      "image/png"
    )
  );
}
