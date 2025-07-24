"use client"
import { motion } from "motion/react"
import imageUrlBuilder from "@sanity/image-url"
import Image from "next/image"
import Link from "next/link"
import { PortableText } from "next-sanity"
import { client } from "@/sanity/client"

const portableTextComponents = {
  block: {
    h1: ({ children }) => (
      <h1 className="text-4xl md:text-5xl font-bold my-8 text-brand-dark font-heading leading-tight tracking-tight">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-3xl md:text-4xl font-bold my-6 text-brand-dark font-heading leading-tight tracking-tight border-l-4 border-citius-orange pl-4">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-2xl md:text-3xl font-semibold my-5 text-brand-dark font-heading leading-tight">{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-xl md:text-2xl font-semibold my-4 text-brand-dark font-heading">{children}</h4>
    ),
    normal: ({ children }) => <p className="text-lg leading-relaxed my-6 text-brand-dark/90">{children}</p>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-citius-orange bg-gradient-to-r from-citius-orange/5 to-transparent pl-6 pr-4 py-4 my-8 rounded-r-lg italic text-lg font-medium text-brand-dark/80">
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => <ul className="list-none my-6 ml-0 space-y-3">{children}</ul>,
    number: ({ children }) => <ol className="list-decimal list-inside my-6 ml-4 space-y-3 text-lg">{children}</ol>,
  },
  listItem: {
    bullet: ({ children }) => (
      <li className="flex items-start gap-3 text-lg leading-relaxed text-brand-dark/90">
        <span className="w-2 h-2 bg-citius-orange rounded-full mt-3 flex-shrink-0"></span>
        <span>{children}</span>
      </li>
    ),
    number: ({ children }) => <li className="text-lg leading-relaxed text-brand-dark/90 mb-2">{children}</li>,
  },
  marks: {
    strong: ({ children }) => (
      <strong className="font-bold text-brand-dark bg-citius-orange/10 px-1 py-0.5 rounded">{children}</strong>
    ),
    em: ({ children }) => <em className="italic text-citius-blue font-medium">{children}</em>,
    link: ({ children, value }) => (
      <a
        href={value.href}
        className="text-citius-blue font-medium underline decoration-2 decoration-citius-orange/30 hover:decoration-citius-orange transition-colors"
        target={value.blank ? "_blank" : "_self"}
        rel={value.blank ? "noopener noreferrer" : undefined}
      >
        {children}
      </a>
    ),
  },
  types: {
    image: ({ value }) => {
      const imageUrl = value?.asset?._ref ? urlFor(value).width(800).url() : null;
      if (!imageUrl) return null;
      return (
        <div className="my-8 flex justify-center">
          <Image
            src={imageUrl}
            alt={value.alt || "Blog image"}
            width={800}
            height={500}
            className="rounded-xl shadow-lg object-cover"
            style={{ maxHeight: 500, width: "auto", height: "auto" }}
          />
        </div>
      );
    },
  },
}

const { projectId, dataset } = client.config()
const urlFor = (source) => (projectId && dataset ? imageUrlBuilder({ projectId, dataset }).image(source) : null)

export default function PostPageClient({ post }) {
  if (!post) {
    return (
      <main className="container mx-auto min-h-screen max-w-4xl pt-16 p-8 flex flex-col gap-4">
        <Link href="/blog" className="hover:underline text-citius-blue">
          ← Back to posts
        </Link>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4 text-brand-dark">Post not found</h1>
          <p className="text-brand-muted">The post you&apos;re looking for doesn&apos;t exist.</p>
        </div>
      </main>
    )
  }

  const postImageUrl = post.mainImage ? urlFor(post.mainImage).url() : null
  const authorImageUrl = post.author?.image ? urlFor(post.author.image).url() : null

  return (
    <main className="container mx-auto min-h-screen max-w-4xl pt-22 p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-8"
      >
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 hover:underline text-citius-blue font-medium transition-colors"
        >
          ← Back to posts
        </Link>
      </motion.div>

      <motion.article
        className="space-y-12"
        initial="hidden"
        animate="show"
        variants={{
          show: { transition: { staggerChildren: 0.15, delayChildren: 0.2 } },
        }}
      >
        <motion.header
          className="space-y-8 text-center"
          variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
        >
          <div className="space-y-6">
            <h1 className="text-5xl md:text-7xl font-bold text-brand-dark font-heading leading-tight tracking-tight">
              {post.title}
            </h1>

            <div className="flex items-center justify-center gap-4 text-sm text-brand-muted">
              <span>📖 {Math.ceil((post.body?.length || 0) / 40)} min read</span>
              <span>•</span>
              <time dateTime={post.publishedAt}>
                {new Date(post.publishedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </div>
          </div>

          {post.categories && post.categories.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3">
              {post.categories.map((category) => (
                <span
                  key={category._id}
                  className="px-4 py-2 bg-gradient-to-r from-citius-orange/10 to-citius-orange/5 text-citius-orange text-sm font-semibold rounded-full border border-citius-orange/20 hover:bg-citius-orange/20 transition-all duration-300 hover:scale-105"
                >
                  {category.title}
                </span>
              ))}
            </div>
          )}
        </motion.header>

        <motion.div
          className="bg-gradient-to-r from-brand-light to-brand-light/50 rounded-2xl p-8 border border-brand-border hover:scale-102 transition-transform duration-300 shadow-lg"
          variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8">
            {post.author && (
              <div className="flex items-center gap-4">
                {authorImageUrl && (
                  <div className="relative">
                    <Image
                      src={authorImageUrl || "/placeholder.svg"}
                      alt={post.author.name || "Author"}
                      className="w-16 h-16 rounded-full object-cover border-3 border-citius-blue shadow-lg"
                      width="64"
                      height="64"
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-brand-light"></div>
                  </div>
                )}
                <div>
                  <p className="font-bold text-lg text-brand-dark">{post.author.name || "Unknown Author"}</p>
                  <p className="text-sm text-brand-muted font-medium">Author</p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 text-sm text-brand-muted sm:ml-auto">
              <div className="flex items-center gap-2 bg-white/50 px-3 py-2 rounded-lg">
                <span className="font-semibold">Published:</span>
                <time dateTime={post.publishedAt} className="text-brand-dark font-medium">
                  {new Date(post.publishedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              </div>
              {post._updatedAt && post._updatedAt !== post._createdAt && (
                <div className="flex items-center gap-2 bg-white/50 px-3 py-2 rounded-lg">
                  <span className="font-semibold">Updated:</span>
                  <time dateTime={post._updatedAt} className="text-brand-dark font-medium">
                    {new Date(post._updatedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </div>
              )}
            </div>
          </div>

          {post.author?.bio && (
            <div className="mt-4 pt-4 border-t border-brand-border/50">
              <div className="text-sm text-brand-muted leading-relaxed bg-white/30 p-4 rounded-lg">
                <PortableText value={post.author.bio} />
              </div>
            </div>
          )}
        </motion.div>

        {postImageUrl && (
          <motion.div
            className="relative w-full aspect-video rounded-3xl overflow-hidden border border-brand-border shadow-2xl hover:scale-102 transition-transform duration-300"
            variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}
          >
            <Image
              src={postImageUrl || "/placeholder.svg"}
              alt={post.title || "Post image"}
              fill
              style={{ objectFit: "cover" }}
              sizes="(max-width: 768px) 100vw, 800px"
              priority
              className="hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
          </motion.div>
        )}

        <motion.div
          className="prose prose-xl max-w-none"
          variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
        >
          {Array.isArray(post.body) && post.body.length > 0 ? (
            <div className="space-y-8">
              <PortableText value={post.body} components={portableTextComponents} />
            </div>
          ) : (
            <div className="text-center py-16 bg-gradient-to-r from-brand-light to-brand-light/50 rounded-2xl border border-brand-border">
              <div className="text-6xl mb-4">📝</div>
              <p className="text-brand-muted italic text-xl">No content available.</p>
            </div>
          )}
        </motion.div>

        <motion.footer
          className="pt-12 mt-16 border-t border-brand-border"
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 bg-gradient-to-r from-brand-light/50 to-transparent p-6 rounded-xl">
            <div className="text-sm text-brand-muted">
              <p className="font-medium">
                📅 Published on{" "}
                <span className="text-brand-dark font-semibold">
                  {new Date(post.publishedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </p>
            </div>
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-citius-blue to-citius-blue/90 text-brand-light rounded-xl hover:from-citius-blue/90 hover:to-citius-blue transition-all duration-300 font-semibold shadow-lg hover:shadow-xl hover:scale-105"
            >
              ← Back to all posts
            </Link>
          </div>
        </motion.footer>
      </motion.article>
    </main>
  )
}
