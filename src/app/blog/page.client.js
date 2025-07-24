"use client";

import { motion } from "motion/react";
import imageUrlBuilder from "@sanity/image-url";
import Image from "next/image";
import Link from "next/link";
import { client } from "@/sanity/client";

const { projectId, dataset } = client.config();
const urlFor = (source) =>
  projectId && dataset
    ? imageUrlBuilder({ projectId, dataset }).image(source)
    : null;

export default function BlogPageClient({ posts }) {
  return (
    <main className="container mx-auto min-h-screen max-w-6xl pt-20 p-8">
      <div className="mb-12 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-5xl md:text-6xl font-bold text-citius-blue font-heading mb-4"
        >
          Latest Posts
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="text-xl text-brand-muted max-w-2xl mx-auto"
        >
          Discover our latest thoughts, insights, and stories from our blog
        </motion.p>
      </div>

      {posts.length > 0 ? (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          initial="hidden"
          animate="show"
          variants={{
            show: { transition: { staggerChildren: 0.1 } },
          }}
        >
          {posts.map((post, index) => {
            const postImageUrl = post.mainImage
              ? urlFor(post.mainImage).url()
              : null;
            return (
              <motion.article
                key={post._id}
                className="group bg-white rounded-2xl border border-brand-border hover:border-citius-blue/30 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden"
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0 },
                }}
              >
                <Link
                  href={`/blog/${post.slug.current}`}
                  className="block h-full"
                >
                  <div className="aspect-[4/3] overflow-hidden rounded-t-2xl relative bg-brand-light w-full">
                    {postImageUrl ? (
                      <Image
                        src={postImageUrl}
                        alt={post.title || "Post image"}
                        fill
                        className="w-auto h-auto rounded-t-2xl object-contain"
                        sizes="(max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-citius-blue/10 to-citius-orange/10">
                        <svg
                          className="w-12 h-12 text-brand-muted"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          role="img"
                        >
                          <title>No image available</title>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}

                    <div className="absolute top-4 left-4 z-10">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-brand-light/90 backdrop-blur-sm text-citius-orange text-sm font-bold rounded-full border border-citius-orange/20 shadow-sm">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                  </div>

                  <div className="p-6 h-full flex flex-col">
                    <div className="mb-4">
                      <time
                        dateTime={post.publishedAt}
                        className="text-sm text-brand-muted font-medium"
                      >
                        {new Date(post.publishedAt).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </time>
                    </div>

                    <h2 className="text-xl font-bold text-brand-dark font-heading group-hover:text-citius-blue transition-colors duration-300 leading-tight flex-grow mb-6">
                      {post.title}
                    </h2>

                    <div className="pt-4 border-t border-brand-border">
                      <span className="inline-flex items-center gap-2 text-citius-blue font-medium group-hover:gap-3 transition-all duration-300">
                        Read more
                        <svg
                          className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          role="img"
                        >
                          <title>Arrow right</title>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.article>
            );
          })}
        </motion.div>
      ) : (
        <div className="text-center py-16">
          <div className="bg-brand-light rounded-2xl border border-brand-border p-12 max-w-md mx-auto">
            <div className="w-16 h-16 bg-citius-orange/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-citius-orange"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
                role="img"
              >
                <title>No posts icon</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-brand-dark font-heading mb-2">
              No posts yet
            </h2>
            <p className="text-brand-muted">
              Check back soon for our latest content and insights.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
