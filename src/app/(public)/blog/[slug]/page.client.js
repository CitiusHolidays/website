"use client";

import { PortableText } from "@portabletext/react";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { blogCoverAlt, blogDate } from "@/lib/blogPresentation";
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
      <p className="my-5 text-pretty text-base text-public-ink/85 leading-8 sm:text-lg">
        {children}
      </p>
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
      const imageUrl = value?.asset?._ref ? urlFor(value)?.width(1200).auto("format").url() : null;
      if (!imageUrl) {
        return null;
      }
      return (
        <figure className="my-12 flex justify-center">
          <Image
            alt={value.alt || "Blog image"}
            className="h-auto max-h-[36rem] w-auto max-w-full rounded-lg object-contain outline-1 outline-black/10 -outline-offset-1"
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

function BackToJournalLink({ postId }) {
  return (
    <Link
      className="inline-flex min-h-11 items-center gap-2 rounded-sm py-2 font-medium text-sm transition-colors duration-150 hover:text-public-orange focus-visible:outline-2 focus-visible:outline-current focus-visible:outline-offset-4"
      href={postId ? `/blog#story-${postId}` : "/blog"}
    >
      <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.5} />
      Back to Journal
    </Link>
  );
}

export default function PostPageClient({ post }) {
  const date = blogDate(post?.publishedAt);
  const coverAlt = post ? blogCoverAlt(post) : null;
  const coverUrl = coverAlt ? urlFor(post.mainImage)?.width(1400).auto("format").url() : null;

  return (
    <article className="min-h-screen bg-public-paper">
      <header className="bg-public-night px-5 pt-28 pb-8 text-white sm:px-8 sm:pt-32 sm:pb-12">
        <div className="mx-auto max-w-4xl">
          <BackToJournalLink postId={post?._id} />
          <h1 className="mt-5 max-w-[32ch] text-pretty font-heading font-semibold text-3xl leading-[1.35] sm:text-4xl lg:text-5xl">
            {post?.title || "Post not found"}
          </h1>
          {post?.author?.name || date ? (
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/75">
              {post?.author?.name ? <span>By {post.author.name}</span> : null}
              {date ? <time dateTime={date.dateTime}>{date.label}</time> : null}
            </div>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 pt-8 sm:px-8 sm:pt-10">
        {coverUrl ? (
          <div className="relative aspect-[16/9] min-w-0 max-w-full overflow-hidden rounded-lg bg-public-surface outline-1 outline-black/10 -outline-offset-1">
            <Image
              alt={coverAlt}
              className="object-cover"
              fill
              loading="eager"
              sizes="(max-width: 895px) 100vw, 832px"
              src={coverUrl}
            />
          </div>
        ) : null}
        <div className={`mx-auto max-w-[68ch] pb-16 sm:pb-24 ${coverUrl ? "pt-6 sm:pt-10" : ""}`}>
          <div className="wrap-anywhere min-w-0 [&>:first-child]:mt-0">
            {Array.isArray(post?.body) && post.body.length > 0 ? (
              <PortableText components={portableTextComponents} value={post.body} />
            ) : (
              <p className="text-public-muted leading-7">
                {post ? "This story is not available yet." : "This post could not be found."}
              </p>
            )}
          </div>
          {post?.author?.bio ? (
            <aside className="mt-10 border-public-ink/15 border-t pt-6">
              <h2 className="font-heading font-semibold text-lg text-public-ink">
                About {post.author.name}
              </h2>
              <PortableText components={portableTextComponents} value={post.author.bio} />
            </aside>
          ) : null}
          <footer className="mt-12 border-public-ink/15 border-t pt-6 text-public-blue">
            <BackToJournalLink postId={post?._id} />
          </footer>
        </div>
      </div>
    </article>
  );
}
