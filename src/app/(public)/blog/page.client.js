"use client";

import { ImageIcon } from "lucide-react";
import { m } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, useAnimatedIconTrigger } from "@/components/ui/AnimatedLucideIcons";
import { blogDate } from "@/lib/blogPresentation";
import { urlFor } from "@/sanity/imageUrl";
import { parseBlogCursor } from "@/sanity/queries/blog";

const BLOG_INTRO = "Travel notes, destination guides, and field stories from the Citius team.";
const ENTRANCE_EASE = [0.32, 0.72, 0, 1];

function PostImage({ post, sizes, eager = false }) {
  const imageUrl = post.mainImage ? urlFor(post.mainImage).url() : null;

  if (!imageUrl) {
    return (
      <div className="flex size-full items-center justify-center bg-public-paper text-public-muted">
        <ImageIcon aria-hidden="true" className="size-10" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <Image
      alt={post.title || "Post image"}
      className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] fine-hover:group-hover:scale-[1.03] motion-reduce:transition-none"
      fetchPriority={eager ? "high" : "auto"}
      fill
      loading={eager ? "eager" : "lazy"}
      sizes={sizes}
      src={imageUrl}
    />
  );
}

function rememberStory(id) {
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${window.location.search}#story-${id}`
  );
}

function PostRow({ index, post }) {
  const date = blogDate(post.publishedAt);
  const rememberCurrentStory = () => rememberStory(post._id);
  const arrowRef = useRef(null);
  const arrowTrigger = useAnimatedIconTrigger(arrowRef);

  return (
    <article className="group">
      <Link
        className="grid gap-6 border-brand-border border-t py-8 focus-visible:outline-2 focus-visible:outline-public-orange-ink focus-visible:outline-offset-4 sm:grid-cols-[7rem_minmax(0,1fr)] sm:py-10 lg:grid-cols-12 lg:items-center lg:gap-8"
        href={`/blog/${post.slug.current}`}
        id={`story-${post._id}`}
        onNavigate={rememberCurrentStory}
        {...arrowTrigger}
      >
        <div className="flex items-center justify-between gap-4 text-public-muted text-sm tabular-nums sm:block lg:col-span-2">
          <span className="font-semibold text-public-orange-ink">
            {String(index + 2).padStart(2, "0")}
          </span>
          {date ? (
            <time className="sm:mt-3 sm:block" dateTime={date.dateTime}>
              {date.label}
            </time>
          ) : null}
        </div>
        <div className="public-media-edge relative aspect-[16/10] overflow-hidden bg-public-surface sm:col-start-2 lg:col-span-4 lg:col-start-auto">
          <PostImage
            post={post}
            sizes="(max-width: 639px) 100vw, (max-width: 1023px) calc(100vw - 9rem), 420px"
          />
        </div>
        <div className="sm:col-start-2 lg:col-span-6 lg:col-start-auto">
          <h3 className="max-w-[22ch] text-balance font-heading font-semibold text-2xl text-public-ink transition-colors duration-300 group-hover:text-public-blue md:text-3xl lg:text-4xl">
            {post.title}
          </h3>
          <span className="mt-5 inline-flex items-center gap-2 font-semibold text-public-blue text-sm">
            Read story
            <ArrowRightIcon
              aria-hidden="true"
              className="size-4 transition-transform duration-300 fine-hover:group-hover:translate-x-1 motion-reduce:transition-none"
              ref={arrowRef}
              size={16}
            />
          </span>
        </div>
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

  const featuredDate = blogDate(featuredPost?.publishedAt);
  const rememberFeaturedStory = () => rememberStory(featuredPost._id);
  const featuredArrowRef = useRef(null);
  const featuredArrowTrigger = useAnimatedIconTrigger(featuredArrowRef);

  return (
    <div className="min-h-screen bg-public-paper">
      <section
        aria-labelledby="blog-title"
        className="relative overflow-hidden bg-public-night px-4 pt-36 pb-20 text-white sm:px-6 lg:px-8 lg:pt-44 lg:pb-28"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 border-white/15 border-b pb-10 lg:grid-cols-12 lg:items-end">
            <m.h1
              animate={{ opacity: 1, transform: "translateY(0)" }}
              className="text-balance font-heading font-semibold text-6xl leading-[0.94] tracking-[-0.04em] sm:text-7xl lg:col-span-8 lg:text-8xl"
              id="blog-title"
              initial={{ opacity: 0, transform: "translateY(20px)" }}
              transition={{ duration: 0.7, ease: ENTRANCE_EASE }}
            >
              Citius Journal
            </m.h1>
            <m.p
              animate={{ opacity: 1, transform: "translateY(0)" }}
              className="max-w-[42ch] text-pretty text-lg text-white/70 leading-8 lg:col-span-4 lg:justify-self-end"
              initial={{ opacity: 0, transform: "translateY(14px)" }}
              transition={{ delay: 0.08, duration: 0.7, ease: ENTRANCE_EASE }}
            >
              {BLOG_INTRO}
            </m.p>
          </div>

          {featuredPost ? (
            <m.article
              animate={{ opacity: 1, transform: "translateY(0)" }}
              className="group mt-10"
              initial={{ opacity: 0, transform: "translateY(24px)" }}
              transition={{ delay: 0.14, duration: 0.8, ease: ENTRANCE_EASE }}
            >
              <Link
                className="grid gap-8 focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-4 lg:grid-cols-12 lg:items-stretch lg:gap-12"
                href={`/blog/${featuredPost.slug.current}`}
                id={`story-${featuredPost._id}`}
                onNavigate={rememberFeaturedStory}
                {...featuredArrowTrigger}
              >
                <div className="public-media-edge relative aspect-video overflow-hidden bg-public-blue/20 lg:col-span-7">
                  <PostImage eager post={featuredPost} sizes="(max-width: 1023px) 100vw, 58vw" />
                </div>
                <div className="flex flex-col justify-between lg:col-span-5 lg:py-3">
                  <div className="flex items-center justify-between gap-5 text-sm text-white/60 tabular-nums">
                    <span className="font-semibold text-public-orange">01</span>
                    {featuredDate ? (
                      <time dateTime={featuredDate.dateTime}>{featuredDate.label}</time>
                    ) : null}
                  </div>
                  <div className="mt-14 lg:mt-8">
                    <h2 className="max-w-[18ch] text-balance font-heading font-semibold text-4xl leading-tight transition-colors duration-300 group-hover:text-public-lime sm:text-5xl">
                      {featuredPost.title}
                    </h2>
                    <span className="mt-8 inline-flex items-center gap-2 font-semibold text-public-lime">
                      Read the latest story
                      <ArrowRightIcon
                        aria-hidden="true"
                        className="size-5 transition-transform duration-300 fine-hover:group-hover:translate-x-1 motion-reduce:transition-none"
                        ref={featuredArrowRef}
                        size={20}
                      />
                    </span>
                  </div>
                </div>
              </Link>
            </m.article>
          ) : null}
        </div>
      </section>

      {featuredPost ? (
        <section
          aria-labelledby="more-posts-title"
          className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
        >
          <div className="mb-8 grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
            <h2
              className="max-w-[18ch] text-balance font-heading font-semibold text-4xl text-public-ink sm:text-5xl"
              id="more-posts-title"
            >
              Recent stories
            </h2>
            <p className="text-public-muted text-sm tabular-nums">
              {remainingPosts.length} {remainingPosts.length === 1 ? "story" : "stories"}
            </p>
          </div>
          <div className="border-brand-border border-b">
            {remainingPosts.map((post, index) => (
              <PostRow index={index} key={post._id} post={post} />
            ))}
          </div>
          <div className="border-public-ink/15 border-t pt-8">
            <p aria-live="polite" className="text-public-muted text-sm" role="status">
              {status === "loaded" ? `${page.posts.length} stories shown.` : null}
              {status === "loading" ? "Loading older stories…" : null}
            </p>
            {status === "error" ? (
              <p className="mb-4 text-public-ink" role="alert">
                We could not load older stories. Try again.
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
        </section>
      ) : (
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="max-w-xl border-brand-border border-t pt-10">
            <ImageIcon aria-hidden="true" className="size-10 text-public-orange-ink" />
            <h2 className="mt-8 font-heading font-semibold text-3xl text-public-ink">
              No posts yet
            </h2>
            <p className="mt-4 text-pretty text-public-muted">
              We have not published any stories yet.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
