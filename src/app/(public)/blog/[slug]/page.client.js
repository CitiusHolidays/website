"use client";
import { m } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { PortableText } from "next-sanity";
import { formatDisplayDate } from "@/lib/formatDate";
import { urlFor } from "@/sanity/imageUrl";

const portableTextComponents = {
  block: {
    blockquote: ({ children }) => (
      <blockquote className="my-8 rounded-r-lg bg-gradient-to-r from-citius-orange/5 to-transparent py-4 pr-4 pl-6 font-medium text-brand-dark/80 text-lg italic shadow-[inset_3px_0_0_rgba(234,88,12,0.45)]">
        {children}
      </blockquote>
    ),
    h1: ({ children }) => (
      <h1 className="my-8 font-bold font-heading text-4xl text-brand-dark leading-tight tracking-tight md:text-5xl">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="my-6 pl-4 font-bold font-heading text-3xl text-brand-dark leading-tight tracking-tight shadow-[inset_3px_0_0_rgba(234,88,12,0.45)] md:text-4xl">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="my-5 font-heading font-semibold text-2xl text-brand-dark leading-tight md:text-3xl">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="my-4 font-heading font-semibold text-brand-dark text-xl md:text-2xl">
        {children}
      </h4>
    ),
    normal: ({ children }) => (
      <p className="my-6 text-brand-dark/90 text-lg leading-relaxed">{children}</p>
    ),
  },
  list: {
    bullet: ({ children }) => <ul className="my-6 ml-0 list-none space-y-3">{children}</ul>,
    number: ({ children }) => (
      <ol className="my-6 ml-4 list-inside list-decimal space-y-3 text-lg">{children}</ol>
    ),
  },
  listItem: {
    bullet: ({ children }) => (
      <li className="flex items-start gap-3 text-brand-dark/90 text-lg leading-relaxed">
        <span className="mt-3 size-2 flex-shrink-0 rounded-full bg-citius-orange" />
        <span>{children}</span>
      </li>
    ),
    number: ({ children }) => (
      <li className="mb-2 text-brand-dark/90 text-lg leading-relaxed">{children}</li>
    ),
  },
  marks: {
    em: ({ children }) => <em className="font-medium text-citius-blue italic">{children}</em>,
    link: ({ children, value }) => (
      <a
        className="font-medium text-citius-blue underline decoration-2 decoration-citius-orange/30 transition-colors hover:decoration-citius-orange"
        href={value.href}
        rel={value.blank ? "noopener noreferrer" : undefined}
        target={value.blank ? "_blank" : "_self"}
      >
        {children}
      </a>
    ),
    strong: ({ children }) => (
      <strong className="rounded bg-citius-orange/10 px-1 py-0.5 font-bold text-brand-dark">
        {children}
      </strong>
    ),
  },
  types: {
    image: ({ value }) => {
      const imageUrl = value?.asset?._ref ? urlFor(value).width(800).url() : null;
      if (!imageUrl) {
        return null;
      }
      return (
        <div className="my-8 flex justify-center">
          <Image
            alt={value.alt || "Blog image"}
            className="rounded-xl object-cover shadow-lg"
            height={500}
            src={imageUrl}
            style={{ height: "auto", maxHeight: 500, width: "auto" }}
            width={800}
          />
        </div>
      );
    },
  },
};

export default function PostPageClient({ post }) {
  if (!post) {
    return (
      <main className="container mx-auto flex min-h-screen max-w-4xl flex-col gap-4 p-8 pt-16">
        <Link className="text-citius-blue hover:underline" href="/blog">
          ← Back to posts
        </Link>
        <div className="py-12 text-center">
          <h1 className="mb-4 font-bold text-2xl text-brand-dark">Post not found</h1>
          <p className="text-brand-muted">The post you&apos;re looking for doesn&apos;t exist.</p>
        </div>
      </main>
    );
  }

  const postImageUrl = post.mainImage ? urlFor(post.mainImage).url() : null;
  const authorImageUrl = post.author?.image ? urlFor(post.author.image).url() : null;

  return (
    <>
      <div className="h-19 bg-[#0B1026]" />
      <main className="container mx-auto min-h-screen max-w-4xl p-8 pt-22">
        <m.div
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <Link
            className="inline-flex items-center gap-2 font-medium text-citius-blue transition-colors hover:underline"
            href="/blog"
          >
            ← Back to posts
          </Link>
        </m.div>

        <m.article
          animate="show"
          className="space-y-12"
          initial="hidden"
          variants={{
            show: { transition: { delayChildren: 0.2, staggerChildren: 0.15 } },
          }}
        >
          <m.header
            className="space-y-8 text-center"
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
          >
            <div className="space-y-6">
              <h1 className="font-bold font-heading text-5xl text-brand-dark leading-tight tracking-tight md:text-7xl">
                {post.title}
              </h1>

              <div className="flex items-center justify-center gap-4 text-brand-muted text-sm">
                <span>📖 {Math.ceil((post.body?.length || 0) / 40)} min read</span>
                <span>•</span>
                <time dateTime={post.publishedAt}>{formatDisplayDate(post.publishedAt)}</time>
              </div>
            </div>

            {post.categories && post.categories.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3">
                {post.categories.map((category) => (
                  <span
                    className="rounded-full border border-citius-orange/20 bg-gradient-to-r from-citius-orange/10 to-citius-orange/5 px-4 py-2 font-semibold text-citius-orange text-sm transition-all duration-300 hover:scale-105 hover:bg-citius-orange/20"
                    key={category._id}
                  >
                    {category.title}
                  </span>
                ))}
              </div>
            )}
          </m.header>

          <m.div
            className="rounded-2xl border border-brand-border bg-gradient-to-r from-brand-light to-brand-light/50 p-8 shadow-lg transition-transform duration-300 hover:scale-102"
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
          >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
              {post.author && (
                <div className="flex items-center gap-4">
                  {authorImageUrl && (
                    <div className="relative">
                      <Image
                        alt={post.author.name || "Author"}
                        className="size-16 rounded-full border-3 border-citius-blue object-cover shadow-lg"
                        height="64"
                        src={authorImageUrl || "/placeholder.svg"}
                        width="64"
                      />
                      <div className="absolute -right-1 -bottom-1 size-5 rounded-full border-2 border-brand-light bg-green-500" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-brand-dark text-lg">
                      {post.author.name || "Unknown Author"}
                    </p>
                    <p className="font-medium text-brand-muted text-sm">Author</p>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-4 text-brand-muted text-sm sm:ml-auto sm:flex-row sm:gap-8">
                <div className="flex items-center gap-2 rounded-lg bg-white/50 px-3 py-2">
                  <span className="font-semibold">Published:</span>
                  <time className="font-medium text-brand-dark" dateTime={post.publishedAt}>
                    {formatDisplayDate(post.publishedAt)}
                  </time>
                </div>
                {post._updatedAt && post._updatedAt !== post._createdAt && (
                  <div className="flex items-center gap-2 rounded-lg bg-white/50 px-3 py-2">
                    <span className="font-semibold">Updated:</span>
                    <time className="font-medium text-brand-dark" dateTime={post._updatedAt}>
                      {formatDisplayDate(post._updatedAt)}
                    </time>
                  </div>
                )}
              </div>
            </div>

            {post.author?.bio && (
              <div className="mt-4 border-brand-border/50 border-t pt-4">
                <div className="rounded-lg bg-white/30 p-4 text-brand-muted text-sm leading-relaxed">
                  <PortableText value={post.author.bio} />
                </div>
              </div>
            )}
          </m.div>

          {postImageUrl && (
            <m.div
              className="relative aspect-video w-full overflow-hidden rounded-3xl border border-brand-border shadow-2xl transition-transform duration-300 hover:scale-102"
              variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}
            >
              <Image
                alt={post.title || "Post image"}
                className="transition-transform duration-700 hover:scale-105"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 800px"
                src={postImageUrl || "/placeholder.svg"}
                style={{ objectFit: "cover" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </m.div>
          )}

          <m.div
            className="prose prose-xl max-w-none"
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
          >
            {Array.isArray(post.body) && post.body.length > 0 ? (
              <div className="space-y-8">
                <PortableText components={portableTextComponents} value={post.body} />
              </div>
            ) : (
              <div className="rounded-2xl border border-brand-border bg-gradient-to-r from-brand-light to-brand-light/50 py-16 text-center">
                <div className="mb-4 text-6xl">📝</div>
                <p className="text-brand-muted text-xl italic">No content available.</p>
              </div>
            )}
          </m.div>

          <m.footer
            className="mt-16 border-brand-border border-t pt-12"
            variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
          >
            <div className="flex flex-col gap-6 rounded-xl bg-gradient-to-r from-brand-light/50 to-transparent p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-brand-muted text-sm">
                <p className="font-medium">
                  📅 Published on{" "}
                  <span className="font-semibold text-brand-dark">
                    {formatDisplayDate(post.publishedAt)}
                  </span>
                </p>
              </div>
              <Link
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-citius-blue to-citius-blue/90 px-6 py-3 font-semibold text-brand-light shadow-lg transition-all duration-300 hover:scale-105 hover:from-citius-blue/90 hover:to-citius-blue hover:shadow-xl"
                href="/blog"
              >
                ← Back to all posts
              </Link>
            </div>
          </m.footer>
        </m.article>
      </main>
    </>
  );
}
