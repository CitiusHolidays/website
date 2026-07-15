"use client";

import { m } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { formatDisplayDate } from "@/lib/formatDate";
import { urlFor } from "@/sanity/imageUrl";

export default function BlogPageClient({ posts }) {
  return (
    <>
      <div className="h-19 bg-[#0B1026]" />
      <div className="min-h-screen bg-[url('/gallery/bgfooter.webp')] bg-center bg-cover">
        <main className="container mx-auto max-w-6xl p-8 pt-20">
          <div className="mb-12 text-center">
            <m.h1
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 font-bold font-heading text-5xl text-citius-blue md:text-6xl"
              initial={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              Latest Posts
            </m.h1>
            <m.p
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto max-w-2xl text-brand-muted text-xl"
              initial={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
            >
              Discover our latest thoughts, insights, and stories from our blog
            </m.p>
          </div>

          {posts.length > 0 ? (
            <m.div
              animate="show"
              className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3"
              initial="hidden"
              variants={{
                show: { transition: { staggerChildren: 0.1 } },
              }}
            >
              {posts.map((post, index) => {
                const postImageUrl = post.mainImage ? urlFor(post.mainImage).url() : null;
                return (
                  <m.article
                    className="group overflow-hidden rounded-2xl border border-brand-border bg-white transition-[translate,border-color,box-shadow] duration-300 fine-hover:hover:-translate-y-1 hover:border-citius-blue/30 hover:shadow-xl"
                    key={post._id}
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      show: { opacity: 1, y: 0 },
                    }}
                  >
                    <Link className="block h-full" href={`/blog/${post.slug.current}`}>
                      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-2xl bg-brand-light">
                        {postImageUrl ? (
                          <Image
                            alt={post.title || "Post image"}
                            className="size-auto rounded-t-2xl object-contain"
                            fill
                            sizes="(max-width: 1024px) 50vw, 33vw"
                            src={postImageUrl}
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center bg-gradient-to-br from-citius-blue/10 to-citius-orange/10">
                            <svg
                              aria-hidden="true"
                              className="size-12 text-brand-muted"
                              fill="none"
                              role="img"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <title>No image available</title>
                              <path
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                              />
                            </svg>
                          </div>
                        )}

                        <div className="absolute top-4 left-4 z-10">
                          <span className="inline-flex size-8 items-center justify-center rounded-full border border-citius-orange/20 bg-brand-light/90 font-bold text-citius-orange text-sm shadow-sm backdrop-blur-sm">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                        </div>
                      </div>

                      <div className="flex h-full flex-col p-6">
                        <div className="mb-4">
                          <time
                            className="font-medium text-brand-muted text-sm"
                            dateTime={post.publishedAt}
                          >
                            {formatDisplayDate(post.publishedAt)}
                          </time>
                        </div>

                        <h2 className="mb-6 flex-grow font-bold font-heading text-brand-dark text-xl leading-tight transition-colors duration-300 group-hover:text-citius-blue">
                          {post.title}
                        </h2>

                        <div className="border-brand-border border-t pt-4">
                          <span className="inline-flex items-center gap-2 font-medium text-citius-blue transition-[gap] duration-300 group-hover:gap-3">
                            Read more
                            <svg
                              aria-hidden="true"
                              className="size-4 transition-transform duration-300 fine-hover:group-hover:translate-x-1"
                              fill="none"
                              role="img"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <title>Arrow right</title>
                              <path
                                d="M9 5l7 7-7 7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                              />
                            </svg>
                          </span>
                        </div>
                      </div>
                    </Link>
                  </m.article>
                );
              })}
            </m.div>
          ) : (
            <div className="py-16 text-center">
              <div className="mx-auto max-w-md rounded-2xl border border-brand-border bg-brand-light p-12">
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-citius-orange/10">
                  <svg
                    aria-hidden="true"
                    className="size-8 text-citius-orange"
                    fill="none"
                    role="img"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <title>No posts icon</title>
                    <path
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                </div>
                <h2 className="mb-2 font-bold font-heading text-2xl text-brand-dark">
                  No posts yet
                </h2>
                <p className="text-brand-muted">
                  Check back soon for our latest content and insights.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
