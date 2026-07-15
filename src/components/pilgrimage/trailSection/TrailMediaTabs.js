import { ArrowRight, ExternalLink, Star, Video } from "lucide-react";
import { m } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { toYoutubeEmbedUrl } from "@/data/trails";

export function GalleryTab({ gallery }) {
  if (!gallery?.length) {
    return null;
  }
  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className="columns-2 gap-4 space-y-4 md:columns-3"
      exit={{ opacity: 0, y: -12 }}
      initial={{ opacity: 0, y: 12 }}
    >
      {gallery.map((img) => (
        <div
          className="break-inside-avoid overflow-hidden rounded-xl border border-brand-light bg-brand-light/30 shadow-sm"
          key={img.src}
        >
          <Image
            alt={img.alt || "Yatra photo"}
            className="h-auto w-full object-cover"
            height={480}
            sizes="(max-width: 768px) 50vw, 33vw"
            src={img.src}
            width={720}
          />
        </div>
      ))}
    </m.div>
  );
}

export function BookingTab({ options }) {
  if (!options?.length) {
    return null;
  }
  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className="grid gap-4 sm:grid-cols-2 md:gap-6"
      exit={{ opacity: 0, y: -12 }}
      initial={{ opacity: 0, y: 12 }}
    >
      {options.map((opt) => {
        const isExternal = opt.href.startsWith("http");
        const className =
          "group flex flex-col rounded-2xl border border-brand-light bg-white p-6 shadow-sm transition-[border-color,box-shadow] hover:border-citius-orange/40 hover:shadow-md";
        const inner = (
          <>
            <span className="mb-2 flex items-center gap-2 font-heading text-citius-blue text-lg">
              {opt.label}
              <ExternalLink className="size-4 opacity-0 transition-opacity group-hover:opacity-60" />
            </span>
            {opt.note && <p className="text-brand-muted text-sm leading-relaxed">{opt.note}</p>}
            <span className="mt-4 font-medium text-citius-orange text-sm">Continue →</span>
          </>
        );
        if (isExternal) {
          return (
            <a
              className={className}
              href={opt.href}
              key={opt.href}
              rel="noopener noreferrer"
              target="_blank"
            >
              {inner}
            </a>
          );
        }
        return (
          <Link className={className} href={opt.href} key={opt.href}>
            {inner}
          </Link>
        );
      })}
    </m.div>
  );
}

export function ReviewsTab({ testimonials }) {
  if (!testimonials?.length) {
    return null;
  }
  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className="grid gap-6 md:grid-cols-2"
      exit={{ opacity: 0, y: -12 }}
      initial={{ opacity: 0, y: 12 }}
    >
      {testimonials.map((t) => (
        <div
          className="rounded-2xl border border-brand-light bg-linear-to-br from-white to-brand-light/40 p-6"
          key={t.id}
        >
          <div className="mb-3 flex gap-1">
            {Array.from({ length: t.rating || 5 }, (_, i) => `${t.id}-star-${i + 1}`).map(
              (starKey) => (
                <Star className="size-4 fill-citius-orange text-citius-orange" key={starKey} />
              )
            )}
          </div>
          <p className="text-brand-dark/90 text-sm italic leading-relaxed">
            &ldquo;{t.quote}&rdquo;
          </p>
          <p className="mt-4 font-heading text-citius-blue text-sm">{t.name}</p>
          <p className="text-brand-muted text-xs">
            {t.location}
            {t.journey ? ` · ${t.journey}` : ""}
          </p>
        </div>
      ))}
    </m.div>
  );
}

export function MediaTab({ media }) {
  const embed = media?.videoUrl ? toYoutubeEmbedUrl(media.videoUrl) : null;
  const hasAr = Boolean(media?.arUrl);
  if (!(embed || hasAr)) {
    return null;
  }
  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
      exit={{ opacity: 0, y: -12 }}
      initial={{ opacity: 0, y: 12 }}
    >
      {embed && (
        <div>
          <h4 className="mb-4 flex items-center gap-2 font-heading text-citius-blue text-lg">
            <Video className="size-5 text-citius-orange" />
            Trip film
          </h4>
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-brand-light bg-brand-dark shadow-lg">
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 size-full"
              sandbox="allow-scripts allow-popups allow-presentation"
              src={embed}
              title="Trail video"
            />
          </div>
        </div>
      )}
      {hasAr && (
        <div className="rounded-2xl border border-citius-orange/20 bg-citius-orange/5 p-6">
          <h4 className="mb-2 font-heading text-citius-orange text-lg">AR experience</h4>
          <p className="mb-4 text-brand-muted text-sm">
            Open the immersive view on a compatible device (link opens in a new tab).
          </p>
          <a
            className="inline-flex items-center gap-2 rounded-full bg-citius-orange px-6 py-3 font-heading text-brand-dark text-sm tracking-wider transition-[filter] hover:brightness-110"
            href={media.arUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            Launch AR
            <ExternalLink className="size-4" />
          </a>
        </div>
      )}
    </m.div>
  );
}

export function BlogsTab({ posts }) {
  if (!posts?.length) {
    return null;
  }
  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
      exit={{ opacity: 0, y: -12 }}
      initial={{ opacity: 0, y: 12 }}
    >
      <p className="mb-4 text-brand-muted text-sm">
        Stories and updates from Citius , hand-picked for this journey.
      </p>
      <ul className="space-y-3">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link
              className="flex items-center justify-between gap-4 rounded-xl border border-brand-light bg-white px-5 py-4 transition-[border-color,box-shadow] hover:border-citius-blue/30 hover:shadow-sm"
              href={`/blog/${post.slug}`}
            >
              <span className="font-heading text-citius-blue">{post.title}</span>
              <ArrowRight className="size-4 shrink-0 text-citius-orange" />
            </Link>
          </li>
        ))}
      </ul>
    </m.div>
  );
}
