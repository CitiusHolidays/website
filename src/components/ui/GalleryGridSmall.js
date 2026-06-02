"use client";

import Image from "next/image";

const EMPTY_IMAGES = [];

export default function GalleryGridSmall({ images = EMPTY_IMAGES, className }) {
  return (
    <div className={`grid gap-6 sm:grid-cols-2 md:grid-cols-3 ${className || ""}`}>
      {/* Map only first 6 images */}
      {images.slice(0, 6).map((item, idx) => (
        <div
          key={item.asset?._id || item._key || idx}
          className="aspect-[4/3] overflow-hidden rounded-lg group relative bg-brand-light"
        >
          <Image
            src={item.asset?.url || ""}
            alt={item.alt || ""}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      ))}
    </div>
  );
}
