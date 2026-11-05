import Image from "next/image";
import kashmir from "@/static/places/kashmir.webp";

export default function FeedbackTripPhoto() {
  return (
    <figure>
      <div className="relative aspect-[16/7] overflow-hidden min-[701px]:aspect-[16/10]">
        <Image
          alt="A shikara on Dal Lake beneath the mountains in Kashmir"
          className="object-cover object-[54%_60%]"
          fill
          preload
          sizes="(max-width: 700px) calc(100vw - 40px), (max-width: 1239px) 40vw, 457px"
          src={kashmir}
        />
      </div>
      <figcaption className="mt-3 text-[#535D6E] text-xs leading-relaxed">
        Kashmir · Citius travel collection
      </figcaption>
    </figure>
  );
}
