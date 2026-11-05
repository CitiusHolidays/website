import Image from "next/image";
import { getImageAlt, getPlateImage } from "./journalContent";

/**
 * A story's picture at its own proportions. Many Journal covers carry their headline inside the
 * artwork, so the plate never crops to a fixed ratio and never lays HTML text over the image.
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
      className={`h-auto w-auto max-w-full object-contain ${maxHeightClass} ${className}`}
      fetchPriority={priority ? "high" : "auto"}
      height={plate.height}
      loading={priority ? "eager" : "lazy"}
      sizes={sizes}
      src={plate.src}
      width={plate.width}
    />
  );
}
