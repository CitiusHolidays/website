"use client";
import { PortableText } from "@portabletext/react";
import { m } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { formatDisplayDate } from "@/lib/formatDate";
import { safePublicHref } from "@/lib/publicHref";
import { urlFor } from "@/sanity/imageUrl";

const portableTextComponents = {
  block: {
    blockquote: ({ children }) => (
      <blockquote className="my-8 border-public-orange-ink border-l-4 py-4 pr-4 pl-6 font-medium text-lg text-public-ink/80 italic">
        {children}
      </blockquote>
    ),
    h1: ({ children }) => (
      <h2 className="my-8 font-bold font-heading text-4xl text-public-ink leading-tight tracking-tight md:text-5xl">
        {children}
      </h2>
    ),
    h2: ({ children }) => (
      <h2 className="my-6 border-public-orange-ink border-l-4 pl-4 font-bold font-heading text-3xl text-public-ink leading-tight tracking-tight md:text-4xl">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="my-5 font-heading font-semibold text-2xl text-public-ink leading-tight md:text-3xl">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="my-4 font-heading font-semibold text-public-ink text-xl md:text-2xl">
        {children}
      </h4>
    ),
    normal: ({ children }) => (
      <p className="my-6 text-lg text-public-ink/90 leading-relaxed">{children}</p>
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
      <li className="flex items-start gap-3 text-lg text-public-ink/90 leading-relaxed">
        <span className="mt-3 size-2 flex-shrink-0 rounded-full bg-public-orange-ink" />
        <span>{children}</span>
      </li>
    ),
    number: ({ children }) => (
      <li className="mb-2 text-lg text-public-ink/90 leading-relaxed">{children}</li>
    ),
  },
  marks: {
    em: ({ children }) => <em className="font-medium text-public-blue italic">{children}</em>,
    link: ({ children, value }) => {
      const href = safePublicHref(value?.href);
      if (!href) {
        return <span>{children}</span>;
      }
      return (
        <a
          className="font-medium text-public-blue underline decoration-2 decoration-public-orange-ink/30 transition-colors hover:decoration-public-orange-ink"
          href={href}
          rel={value?.blank ? "noopener noreferrer" : undefined}
          target={value?.blank ? "_blank" : "_self"}
        >
          {children}
        </a>
      );
    },
    strong: ({ children }) => (
      <strong className="rounded bg-public-orange-ink/10 px-1 py-0.5 font-bold text-public-ink">
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
      <section className="container mx-auto flex min-h-screen max-w-4xl flex-col gap-4 p-8 pt-16">
        <Link className="text-public-blue hover:underline" href="/blog">
          ← Back to posts
        </Link>
        <div className="py-12 text-center">
          <h1 className="mb-4 font-bold font-heading text-2xl text-public-ink">Post not found</h1>
          <p className="text-public-muted">The post you&apos;re looking for doesn&apos;t exist.</p>
        </div>
      </section>
    );
  }

  const postImageUrl = post.mainImage ? urlFor(post.mainImage).url() : null;
  const authorImageUrl = post.author?.image ? urlFor(post.author.image).url() : null;

  return (
    <>
      <div className="h-19 bg-public-night" />
      <div className="container mx-auto min-h-screen max-w-4xl bg-public-paper p-8 pt-22">
        <m.div
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <Link
            className="inline-flex items-center gap-2 font-medium text-public-blue transition-colors hover:underline"
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
              <h1 className="font-bold font-heading text-5xl text-public-ink leading-tight tracking-tight md:text-7xl">
                {post.title}
              </h1>

              <div className="flex items-center justify-center gap-4 text-public-muted text-sm">
                <span>{Math.ceil((post.body?.length || 0) / 40)} min read</span>
                <span>•</span>
                <time dateTime={post.publishedAt}>{formatDisplayDate(post.publishedAt)}</time>
              </div>
            </div>

            {post.categories && post.categories.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3">
                {post.categories.map((category) => (
                  <span
                    className="rounded-full border border-public-orange-ink/20 bg-public-orange-ink/10 px-4 py-2 font-semibold text-public-orange-ink text-sm"
                    key={category._id}
                  >
                    {category.title}
                  </span>
                ))}
              </div>
            )}
          </m.header>

          <m.div
            className="rounded-2xl border border-public-blue/15 bg-public-surface p-8"
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
          >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
              {post.author ? (
                <div className="flex items-center gap-4">
                  {authorImageUrl ? (
                    <div className="relative">
                      <Image
                        alt={post.author.name || "Author"}
                        className="size-16 rounded-full border-3 border-public-blue object-cover"
                        height="64"
                        src={authorImageUrl}
                        width="64"
                      />
                      <div className="absolute -right-1 -bottom-1 size-5 rounded-full border-2 border-public-surface bg-public-green" />
                    </div>
                  ) : null}
                  <div>
                    <p className="font-bold text-lg text-public-ink">
                      {post.author.name || "Unknown Author"}
                    </p>
                    <p className="font-medium text-public-muted text-sm">Author</p>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-4 text-public-muted text-sm sm:ml-auto sm:flex-row sm:gap-8">
                <div className="flex items-center gap-2 rounded-lg bg-public-paper px-3 py-2">
                  <span className="font-semibold">Published:</span>
                  <time className="font-medium text-public-ink" dateTime={post.publishedAt}>
                    {formatDisplayDate(post.publishedAt)}
                  </time>
                </div>
                {post._updatedAt && post._updatedAt !== post._createdAt && (
                  <div className="flex items-center gap-2 rounded-lg bg-public-paper px-3 py-2">
                    <span className="font-semibold">Updated:</span>
                    <time className="font-medium text-public-ink" dateTime={post._updatedAt}>
                      {formatDisplayDate(post._updatedAt)}
                    </time>
                  </div>
                )}
              </div>
            </div>

            {post.author?.bio ? (
              <div className="mt-4 border-public-blue/15 border-t pt-4">
                <div className="rounded-lg bg-public-paper p-4 text-public-muted text-sm leading-relaxed">
                  <PortableText components={portableTextComponents} value={post.author.bio} />
                </div>
              </div>
            ) : null}
          </m.div>

          {postImageUrl ? (
            <m.div
              className="public-media-edge relative aspect-video w-full overflow-hidden border border-public-blue/15"
              variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}
            >
              <Image
                alt={post.title || "Post image"}
                className="object-cover"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 800px"
                src={postImageUrl}
                style={{ objectFit: "cover" }}
              />
            </m.div>
          ) : null}

          <m.div
            className="prose prose-xl max-w-none"
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
          >
            {Array.isArray(post.body) && post.body.length > 0 ? (
              <div className="space-y-8">
                <PortableText components={portableTextComponents} value={post.body} />
              </div>
            ) : (
              <div className="rounded-2xl border border-public-blue/15 bg-public-surface py-16 text-center">
                <p className="text-public-muted text-xl italic">No content available.</p>
              </div>
            )}
          </m.div>

          <m.footer
            className="mt-16 border-public-blue/15 border-t pt-12"
            variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
          >
            <div className="flex flex-col gap-6 rounded-xl bg-public-surface p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-public-muted text-sm">
                <p className="font-medium">
                  Published on{" "}
                  <span className="font-semibold text-public-ink">
                    {formatDisplayDate(post.publishedAt)}
                  </span>
                </p>
              </div>
              <Link
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-public-blue px-6 py-3 font-semibold text-public-surface transition-colors hover:bg-public-night focus-visible:outline-2 focus-visible:outline-public-orange-ink focus-visible:outline-offset-2"
                href="/blog"
              >
                ← Back to all posts
              </Link>
            </div>
          </m.footer>
        </m.article>
      </div>
    </>
  );
}
