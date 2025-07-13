"use client";

import Image from "next/image";

export default function GalleryGridSmall({ images = [], className }) {
  return (
    <div
      className={`grid gap-6 sm:grid-cols-2 md:grid-cols-3 ${className || ""}`}
    >
      {/* Map only first 6 images */}
      {images.slice(0, 6).map((item, idx) => (
        <div
          key={item.asset?._id || item._key || idx}
          className="aspect-[4/3] overflow-hidden rounded-lg group relative bg-gray-100"
        >
          <Image
            src={item.asset?.url || ""}
            alt={item.alt || ""}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      ))}
    </div>
  );
}
