"use client";

import Image from "next/image";

const EMPTY_IMAGES = [];

export default function GalleryGridSmall({ images = EMPTY_IMAGES, className }) {
  return (
    <div className={`grid gap-6 sm:grid-cols-2 md:grid-cols-3 ${className || ""}`}>
      {/* Map only first 6 images */}
      {images.slice(0, 6).map((item, idx) => (
        <div
          className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-brand-light"
          key={item.asset?._id || item._key || idx}
        >
          <Image
            alt={item.alt || ""}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
            src={item.asset?.url || ""}
          />
        </div>
      ))}
    </div>
  );
}
