import Image from "next/image";
import { getImageAlt, getPlateImage } from "./journalContent";

/**
 * Width that keeps a plate inside its column, its source width, and its height cap. With an
 * explicit width plus `height: auto`, the browser reserves the plate's full box from the
 * `width`/`height` attributes before the file arrives; `width: auto` gave the unloaded image no
 * size, so the story below it jumped when the cover loaded. Callers set `--plate-max-h`.
 */
export const JOURNAL_PLATE_FIT_CLASS =
  "h-auto w-[min(100%,var(--plate-width),calc(var(--plate-max-h,100vh)*var(--plate-ratio)))] max-w-full";

export function journalPlateFitStyle(plate) {
  return {
    "--plate-ratio": `${plate.width} / ${plate.height}`,
    "--plate-width": `${plate.width}px`,
  };
}

/**
 * A story's picture at its own proportions. Many Journal covers carry their headline inside the
 * artwork, so the plate never crops to a fixed ratio and never lays HTML text over the image.
 * `maxHeightClass` sets `--plate-max-h` (for example `[--plate-max-h:36rem]`).
 */
export default function JournalPlate({
  alt,
  className = "",
  image,
  maxHeightClass = "",
  priority = false,
  sizes,
  width = 1600,
}) {
  const plate = getPlateImage(image, width);
  if (!plate) {
    return null;
  }
  return (
    <Image
      alt={alt ?? getImageAlt(image)}
      className={`${JOURNAL_PLATE_FIT_CLASS} object-contain ${maxHeightClass} ${className}`}
      fetchPriority={priority ? "high" : "auto"}
      height={plate.height}
      loading={priority ? "eager" : "lazy"}
      sizes={sizes}
      src={plate.src}
      style={journalPlateFitStyle(plate)}
      width={plate.width}
    />
  );
}
