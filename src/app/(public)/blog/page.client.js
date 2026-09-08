"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { blogCoverAlt, blogDate, blogExcerpt } from "@/lib/blogPresentation";
import { urlFor } from "@/sanity/imageUrl";
import { parseBlogCursor } from "@/sanity/queries/blog";

function Story({ featured = false, post }) {
  const date = blogDate(post.publishedAt);
  const excerpt = blogExcerpt(post);
  const alt = blogCoverAlt(post);
  const imageUrl = alt ? urlFor(post.mainImage)?.width(1000).auto("format").url() : null;
  const Heading = featured ? "h2" : "h3";
  const rememberStory = () => {
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}#story-${post._id}`
    );
  };

  return (
    <article>
      <Link
        className={`group grid min-w-0 scroll-mt-28 items-center gap-5 rounded-sm focus-visible:outline-2 focus-visible:outline-public-orange-ink focus-visible:outline-offset-8 ${
          featured
            ? "py-8 sm:py-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-12"
            : "border-public-ink/15 border-t py-7 sm:grid-cols-[minmax(0,1fr)_8rem] sm:gap-10"
        }`}
        href={`/blog/${post.slug.current}`}
        id={`story-${post._id}`}
        onNavigate={rememberStory}
      >
        <div className="min-w-0">
          {date ? (
            <time className="mb-3 block text-public-muted text-sm" dateTime={date.dateTime}>
              {date.label}
            </time>
          ) : null}
          <Heading
            className={`text-pretty font-heading font-semibold text-public-ink leading-[1.3] transition-colors duration-150 group-hover:text-public-blue ${
              featured
                ? "max-w-[28ch] text-3xl sm:text-4xl lg:text-[2.75rem]"
                : "max-w-[44ch] text-xl sm:text-2xl"
            }`}
          >
            {post.title}
          </Heading>
          {excerpt ? (
            <p className="mt-4 max-w-[60ch] text-pretty text-base text-public-muted leading-7">
              {excerpt}
            </p>
          ) : null}
          <ArrowRight
            aria-hidden="true"
            className="mt-5 size-5 text-public-blue transition-transform duration-150 group-hover:translate-x-1 motion-reduce:transition-none"
            strokeWidth={1.5}
          />
        </div>
        {imageUrl ? (
          <div
            className={`relative min-w-0 max-w-full overflow-hidden rounded-lg bg-public-surface outline-1 outline-black/10 -outline-offset-1 ${
              featured ? "aspect-[4/3] w-full" : "aspect-[4/3] w-32 sm:w-full"
            }`}
          >
            <Image
              alt={alt}
              className="object-cover"
              fill
              loading={featured ? "eager" : "lazy"}
              sizes={featured ? "(max-width: 1023px) 100vw, 480px" : "128px"}
              src={imageUrl}
            />
          </div>
        ) : null}
      </Link>
    </article>
  );
}

export default function BlogPageClient({ initialPage }) {
  const [page, setPage] = useState(initialPage);
  const [status, setStatus] = useState("idle");
  const loading = useRef(false);
  const focusAfterLoad = useRef(null);
  const [featuredPost, ...remainingPosts] = page.posts;

  // ponytail: Next's route cache covers direct reader returns; use URL cursors
  // if restoration after a hard reload is needed. The hash restores focus below the header.
  useEffect(() => {
    const storyId = window.location.hash.slice(1);
    if (!storyId.startsWith("story-")) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      const story = document.getElementById(storyId);
      story?.focus({ preventScroll: true });
      story?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (page.posts.some((post) => post._id === focusAfterLoad.current)) {
      document.getElementById(`story-${focusAfterLoad.current}`)?.focus({ preventScroll: true });
      focusAfterLoad.current = null;
    }
  }, [page]);

  const loadOlderStories = async () => {
    if (loading.current || !page.nextCursor) {
      return;
    }
    loading.current = true;
    setStatus("loading");
    try {
      const response = await fetch(`/api/blog?after=${encodeURIComponent(page.nextCursor)}`);
      if (!response.ok) {
        throw new Error("Stories unavailable");
      }
      const next = await response.json();
      parseBlogCursor(next.nextCursor);
      if (!Array.isArray(next.posts) || next.nextCursor === page.nextCursor) {
        throw new Error("Invalid journal page");
      }
      const existing = new Set(page.posts.map((post) => post._id));
      const added = next.posts.filter((post) => !existing.has(post._id));
      focusAfterLoad.current = added[0]?._id;
      setPage({ nextCursor: next.nextCursor, posts: [...page.posts, ...added] });
      setStatus("loaded");
    } catch {
      setStatus("error");
    } finally {
      loading.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-public-paper">
      <header className="bg-public-night px-5 pt-28 pb-8 text-white sm:px-8 sm:pt-32 sm:pb-10">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end md:gap-12">
          <h1 className="font-heading font-semibold text-3xl leading-tight sm:text-4xl">
            Citius Journal
          </h1>
          <p className="max-w-[42ch] text-pretty text-base text-white/75 leading-7">
            Travel notes, destination guides, and stories from the Citius team.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pb-16 sm:px-8 sm:pb-24">
        {featuredPost ? (
          <>
            <Story featured post={featuredPost} />
            {remainingPosts.length > 0 ? (
              <section aria-labelledby="recent-stories" className="mt-4 sm:mt-8">
                <h2
                  className="mb-6 font-heading font-medium text-lg text-public-ink"
                  id="recent-stories"
                >
                  Recent stories
                </h2>
                {remainingPosts.map((post) => (
                  <Story key={post._id} post={post} />
                ))}
              </section>
            ) : null}
            <div className="border-public-ink/15 border-t pt-8">
              <p aria-live="polite" className="text-public-muted text-sm" role="status">
                {status === "loaded" ? `${page.posts.length} stories shown.` : null}
                {status === "loading" ? "Loading older stories…" : null}
              </p>
              {status === "error" ? (
                <p className="mb-4 text-public-ink" role="alert">
                  Older stories couldn’t be loaded. Your place in the journal is kept.
                </p>
              ) : null}
              {page.nextCursor ? (
                <button
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-public-ink/25 px-6 py-2.5 font-semibold text-public-blue text-sm transition-colors duration-150 hover:bg-public-blue/5 focus-visible:outline-2 focus-visible:outline-public-orange-ink focus-visible:outline-offset-4 disabled:cursor-wait disabled:opacity-60"
                  disabled={status === "loading"}
                  onClick={loadOlderStories}
                  type="button"
                >
                  {status === "error" ? "Retry" : "Older stories"}
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <section className="max-w-xl py-12 sm:py-16">
            <h2 className="font-heading font-semibold text-2xl text-public-ink">
              The next story is on its way
            </h2>
            <p className="mt-4 text-public-muted leading-7">
              Come back soon for travel notes and ideas from the Citius team.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
