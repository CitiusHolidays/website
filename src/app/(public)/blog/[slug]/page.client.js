"use client";

import { PortableText } from "@portabletext/react";
import { ImageIcon } from "lucide-react";
import { m } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { ArrowLeftIcon, useAnimatedIconTrigger } from "@/components/ui/AnimatedLucideIcons";
import { formatDisplayDate } from "@/lib/formatDate";
import { safePublicHref } from "@/lib/publicHref";
import { urlFor } from "@/sanity/imageUrl";

const portableTextComponents = {
  block: {
    blockquote: ({ children }) => (
      <blockquote className="my-8 border-public-orange-ink/30 border-l-4 pl-6 text-base text-public-muted leading-7">
        {children}
      </blockquote>
    ),
    h1: ({ children }) => (
      <h2 className="mt-12 mb-4 text-balance font-heading font-semibold text-3xl text-public-ink md:text-4xl">
        {children}
      </h2>
    ),
    h2: ({ children }) => (
      <h2 className="mt-10 mb-4 text-balance font-heading font-semibold text-2xl text-public-ink md:text-3xl">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-8 mb-3 text-balance font-heading font-semibold text-public-ink text-xl md:text-2xl">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="mt-6 mb-2 font-heading font-semibold text-lg text-public-ink md:text-xl">
        {children}
      </h4>
    ),
    normal: ({ children }) => (
      <p className="my-5 text-pretty text-base text-public-muted leading-7">{children}</p>
    ),
  },
  list: {
    bullet: ({ children }) => <ul className="my-6 space-y-3">{children}</ul>,
    number: ({ children }) => (
      <ol className="my-6 ml-5 list-decimal space-y-3 marker:text-public-muted">{children}</ol>
    ),
  },
  listItem: {
    bullet: ({ children }) => (
      <li className="grid grid-cols-[0.5rem_1fr] items-start gap-3 text-base text-public-muted leading-7">
        <span className="mt-2.5 size-1.5 rounded-full bg-public-orange-ink" />
        <span>{children}</span>
      </li>
    ),
    number: ({ children }) => (
      <li className="pl-1 text-base text-public-muted leading-7">{children}</li>
    ),
  },
  marks: {
    em: ({ children }) => <em className="text-public-ink">{children}</em>,
    link: ({ children, value }) => {
      const href = safePublicHref(value?.href);
      if (!href) {
        return <span>{children}</span>;
      }
      return (
        <a
          className="font-medium text-public-blue underline decoration-1 underline-offset-4 transition-colors duration-200 hover:text-public-ink focus-visible:outline-2 focus-visible:outline-public-orange-ink focus-visible:outline-offset-2"
          href={href}
          rel={value?.blank ? "noopener noreferrer" : undefined}
          target={value?.blank ? "_blank" : "_self"}
        >
          {children}
        </a>
      );
    },
    strong: ({ children }) => <strong className="font-semibold text-public-ink">{children}</strong>,
  },
  types: {
    image: ({ value }) => {
      const imageUrl = value?.asset?._ref ? urlFor(value).width(1200).url() : null;
      if (!imageUrl) {
        return null;
      }
      return (
        <figure className="my-12 flex justify-center">
          <Image
            alt={value.alt || "Blog image"}
            className="public-media-edge h-auto max-h-[36rem] w-auto object-cover"
            height={750}
            sizes="(max-width: 767px) 100vw, 768px"
            src={imageUrl}
            width={1200}
          />
        </figure>
      );
    },
  },
};

function BackToBlogLink({ children, tone = "light" }) {
  const arrowRef = useRef(null);
  const arrowTrigger = useAnimatedIconTrigger(arrowRef);
  return (
    <Link
      className={`group inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-2 font-semibold transition-[background-color,color,transform] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-2 focus-visible:outline-public-orange-ink focus-visible:outline-offset-4 active:scale-[0.98] ${
        tone === "dark"
          ? "text-white hover:bg-white/10"
          : "bg-public-night text-white hover:bg-public-blue"
      }`}
      href="/blog"
      {...arrowTrigger}
    >
      <ArrowLeftIcon
        aria-hidden="true"
        className="size-4 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] fine-hover:group-hover:-translate-x-1 motion-reduce:transition-none"
        ref={arrowRef}
        size={16}
      />
      {children}
    </Link>
  );
}

export default function PostPageClient({ post }) {
  if (!post) {
    return (
      <section className="min-h-screen bg-public-paper px-4 pt-36 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <BackToBlogLink>Back to posts</BackToBlogLink>
          <div className="mt-16 rounded-3xl bg-public-surface p-8 shadow-[var(--shadow-public-media)] sm:p-12">
            <ImageIcon aria-hidden="true" className="size-10 text-public-orange-ink" />
            <h1 className="mt-8 font-heading font-semibold text-3xl text-public-ink">
              Post not found
            </h1>
            <p className="mt-4 text-pretty text-public-muted">
              The post you&apos;re looking for doesn&apos;t exist.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const postImageUrl = post.mainImage ? urlFor(post.mainImage).url() : null;
  const authorImageUrl = post.author?.image ? urlFor(post.author.image).url() : null;

  return (
    <article className="min-h-screen bg-public-paper">
      <header className="bg-public-night px-4 pt-32 pb-24 text-white sm:px-6 lg:px-8 lg:pt-40 lg:pb-32">
        <div className="mx-auto max-w-7xl">
          <m.div
            animate={{ opacity: 1, transform: "translateY(0)" }}
            initial={{ opacity: 0, transform: "translateY(16px)" }}
            transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
          >
            <BackToBlogLink tone="dark">Back to posts</BackToBlogLink>
          </m.div>

          <m.div
            animate={{ opacity: 1, transform: "translateY(0)" }}
            className="mt-12"
            initial={{ opacity: 0, transform: "translateY(32px)" }}
            transition={{ delay: 0.1, duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
          >
            <h1 className="max-w-5xl text-balance bg-gradient-to-r from-white to-[#9B9B9B] bg-clip-text font-heading font-semibold text-5xl text-transparent md:text-6xl lg:text-7xl">
              {post.title}
            </h1>

            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3 text-sm text-white/65">
              <span>{Math.ceil((post.body?.length || 0) / 40)} min read</span>
              <span aria-hidden="true" className="size-1 rounded-full bg-public-orange" />
              <time dateTime={post.publishedAt}>{formatDisplayDate(post.publishedAt)}</time>
            </div>

            {post.categories?.length > 0 ? (
              <div className="mt-8 flex flex-wrap gap-3">
                {post.categories.map((category) => (
                  <span
                    className="rounded-full border border-white/20 px-3 py-2 font-semibold text-sm text-white/80"
                    key={category._id}
                  >
                    {category.title}
                  </span>
                ))}
              </div>
            ) : null}
          </m.div>
        </div>
      </header>

      {postImageUrl ? (
        <m.div
          className="relative z-10 mx-auto -mt-12 max-w-7xl px-4 sm:px-6 lg:px-8"
          initial={{ opacity: 0, transform: "translateY(32px)" }}
          transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
          viewport={{ amount: 0.2, once: true }}
          whileInView={{ opacity: 1, transform: "translateY(0)" }}
        >
          <div className="public-media-edge relative aspect-video w-full overflow-hidden bg-public-surface">
            <Image
              alt={post.title || "Post image"}
              className="object-cover"
              fill
              loading="eager"
              sizes="(max-width: 1279px) 100vw, 1280px"
              src={postImageUrl}
            />
          </div>
        </m.div>
      ) : null}

      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <section
          aria-label="Article details"
          className="flex flex-col gap-8 border-brand-border border-b pb-12 sm:flex-row sm:items-center sm:justify-between"
        >
          {post.author ? (
            <div className="flex items-center gap-4">
              {authorImageUrl ? (
                <Image
                  alt={post.author.name || "Author"}
                  className="size-14 rounded-xl object-cover"
                  height={56}
                  src={authorImageUrl}
                  width={56}
                />
              ) : null}
              <div>
                <p className="font-semibold text-public-ink">
                  {post.author.name || "Unknown Author"}
                </p>
                <p className="mt-1 text-public-muted text-sm">Author</p>
              </div>
            </div>
          ) : null}

          {post._updatedAt && post._updatedAt !== post._createdAt ? (
            <p className="text-public-muted text-sm">
              Updated{" "}
              <time className="font-medium text-public-ink" dateTime={post._updatedAt}>
                {formatDisplayDate(post._updatedAt)}
              </time>
            </p>
          ) : null}
        </section>

        {post.author?.bio ? (
          <aside className="mt-8 rounded-2xl bg-public-surface p-6 text-public-muted text-sm shadow-sm">
            <PortableText components={portableTextComponents} value={post.author.bio} />
          </aside>
        ) : null}

        <m.div
          className="mt-12"
          initial={{ opacity: 0, transform: "translateY(32px)" }}
          transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
          viewport={{ amount: 0.05, once: true }}
          whileInView={{ opacity: 1, transform: "translateY(0)" }}
        >
          {Array.isArray(post.body) && post.body.length > 0 ? (
            <PortableText components={portableTextComponents} value={post.body} />
          ) : (
            <div className="rounded-2xl bg-public-surface p-8 text-center shadow-sm sm:p-12">
              <p className="text-lg text-public-muted">No content available.</p>
            </div>
          )}
        </m.div>

        <footer className="mt-16 border-brand-border border-t pt-12">
          <BackToBlogLink>Back to all posts</BackToBlogLink>
        </footer>
      </div>
    </article>
  );
}
