import { PortableText } from "@portabletext/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import JournalByline from "@/components/blog/JournalByline";
import JournalJsonLd from "@/components/blog/JournalJsonLd";
import JournalMeta from "@/components/blog/JournalMeta";
import JournalPlate from "@/components/blog/JournalPlate";
import JournalPortableText from "@/components/blog/JournalPortableText";
import JournalTalkToTeam from "@/components/blog/JournalTalkToTeam";
import {
  buildBlogPostingJsonLd,
  buildBreadcrumbJsonLd,
  cleanText,
  formatJournalDate,
  getCroppedImageUrl,
  getExcerpt,
  getImageAlt,
  getJournalUpdatedDate,
  isTrailSlug,
  JOURNAL_NAME,
  journalPostUrl,
  SITE_URL,
} from "@/components/blog/journalContent";
import { journalFont } from "@/components/blog/journalFont";
import { getTrailBySlug } from "@/data/trails";
import { cachedSanityFetch } from "@/sanity/cachedFetch";

const POST_QUERY = `*[_type == "post" && slug.current == $slug][0]{
  _id,
  _createdAt,
  _updatedAt,
  title,
  slug,
  publishedAt,
  mainImage,
  body,
  excerpt,
  relatedTrail,
  author->{
    _id,
    name,
    role,
    office,
    slug,
    image,
    bio
  },
  categories[]->{
    _id,
    title,
    description
  },
  "more": *[_type == "post" && defined(slug.current) && slug.current != $slug]
    |order(coalesce(publishedAt, _createdAt) desc)[0...2]{
      _id,
      _createdAt,
      title,
      slug,
      publishedAt,
      "wordCount": length(string::split(pt::text(body), " "))
    }
}`;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await cachedSanityFetch(POST_QUERY, { slug }, ["blog"]);

  if (!post) {
    return { title: "Story not found" };
  }

  const imageUrl = getCroppedImageUrl(post.mainImage, 1200, 630);
  const description = getExcerpt(post, 160);
  const url = journalPostUrl(slug);
  const authorName = post.author?.name || "Citius Holidays";

  return {
    alternates: { canonical: url },
    authors: [{ name: authorName }],
    description,
    keywords: post.categories?.map((category) => category.title).join(", "),
    openGraph: {
      authors: [authorName],
      description,
      images: imageUrl
        ? [
            {
              alt: getImageAlt(post.mainImage, post.title),
              height: 630,
              url: imageUrl,
              width: 1200,
            },
          ]
        : [],
      locale: "en_US",
      modifiedTime: post._updatedAt,
      publishedTime: post.publishedAt || post._createdAt,
      siteName: "Citius Holidays",
      tags: post.categories?.map((category) => category.title),
      title: post.title,
      type: "article",
      url,
    },
    title: { absolute: `${post.title} | ${JOURNAL_NAME}` },
    twitter: {
      card: "summary_large_image",
      description,
      images: imageUrl ? [imageUrl] : [],
      title: post.title,
    },
  };
}

export default function PostPage({ params }) {
  return (
    <Suspense fallback={<JournalStoryLoadingShell />}>
      <PostContent params={params} />
    </Suspense>
  );
}

function JournalStoryLoadingShell() {
  return (
    <section
      aria-label="Loading story"
      className="min-h-screen animate-pulse bg-public-paper motion-reduce:animate-none"
      role="status"
    >
      <div className="bg-public-night px-4 pt-32 pb-16 sm:px-6 lg:px-8 lg:pt-40 lg:pb-20">
        <div className="mx-auto max-w-7xl">
          <div className="h-5 w-32 rounded bg-white/10" />
          <div className="mt-10 h-12 max-w-4xl rounded-lg bg-white/10 md:h-16" />
          <div className="mt-4 h-12 max-w-2xl rounded-lg bg-white/10 md:h-16" />
          <div className="mt-10 h-11 w-64 rounded bg-white/10" />
        </div>
      </div>
      <div className="mx-auto max-w-[68ch] space-y-5 px-4 py-16 sm:px-6">
        <div className="h-4 w-full rounded bg-public-blue/10" />
        <div className="h-4 w-full rounded bg-public-blue/10" />
        <div className="h-4 w-5/6 rounded bg-public-blue/10" />
      </div>
    </section>
  );
}

const BIO_COMPONENTS = {
  block: {
    normal: ({ children }) => <p className="mt-3 first:mt-0">{children}</p>,
  },
};

function RelatedTrail({ slug }) {
  if (!isTrailSlug(slug)) {
    return null;
  }
  const trail = getTrailBySlug(slug);
  if (!(trail && ["comingSoon", "published"].includes(trail.status))) {
    return null;
  }
  return (
    <aside aria-labelledby="journal-trail-title" className="mt-14 bg-public-surface p-6 sm:p-8">
      <h2 className="font-semibold text-public-muted text-sm" id="journal-trail-title">
        The route in this story
      </h2>
      <Link
        className="group font-(family-name:--font-journal) mt-3 inline-flex items-center gap-3 font-medium text-2xl text-public-ink transition-colors duration-200 hover:text-public-blue focus-visible:outline-2 focus-visible:outline-public-orange-ink focus-visible:outline-offset-4"
        href={`/pilgrimage/${trail.slug}`}
      >
        {trail.title}
        <ArrowRight
          aria-hidden="true"
          className="size-5 shrink-0 transition-transform duration-200 fine-hover:group-hover:translate-x-1 motion-reduce:transition-none"
        />
      </Link>
      {trail.subtitle ? (
        <p className="mt-2 text-base text-public-ink/85 leading-relaxed">{trail.subtitle}</p>
      ) : null}
    </aside>
  );
}

function AuthorNote({ author }) {
  if (!(author?.name && Array.isArray(author.bio) && author.bio.length > 0)) {
    return null;
  }
  return (
    <aside aria-labelledby="journal-author-title" className="mt-14 bg-public-surface p-6 sm:p-8">
      <h2 className="sr-only" id="journal-author-title">
        About {author.name}
      </h2>
      <JournalByline author={author} />
      <div className="mt-4 text-base text-public-ink/85 leading-relaxed">
        <PortableText components={BIO_COMPONENTS} value={author.bio} />
      </div>
    </aside>
  );
}

function MoreFromJournal({ posts }) {
  if (!posts?.length) {
    return null;
  }
  return (
    <section
      aria-labelledby="journal-more-title"
      className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28"
    >
      <h2
        className="font-(family-name:--font-journal) font-medium text-3xl text-public-ink sm:text-4xl"
        id="journal-more-title"
      >
        More from the Journal
      </h2>
      <ul className="mt-8 grid gap-10 md:grid-cols-2 md:gap-12">
        {posts.map((post) => (
          <li className="group relative" key={post._id}>
            <h3 className="font-(family-name:--font-journal) max-w-[28ch] text-balance font-medium text-2xl text-public-ink leading-snug">
              <Link
                className="transition-colors duration-200 after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-public-orange-ink focus-visible:after:outline-offset-4 group-hover:text-public-blue"
                href={`/blog/${post.slug.current}`}
              >
                {post.title}
              </Link>
            </h3>
            <JournalMeta className="mt-3 text-public-muted" post={post} />
          </li>
        ))}
      </ul>
    </section>
  );
}

async function PostContent({ params }) {
  const { slug } = await params;
  const post = await cachedSanityFetch(POST_QUERY, { slug }, ["blog"]);

  if (!post) {
    notFound();
  }

  const standfirst = cleanText(post.excerpt);
  const updatedAt = getJournalUpdatedDate(post);
  const categories = (post.categories ?? []).flatMap((category) =>
    category?.title ? [category.title] : []
  );
  const hasCover = Boolean(post.mainImage?.asset);
  const structuredImage = getCroppedImageUrl(post.mainImage, 1200, 630);

  return (
    <article className={`${journalFont.variable} bg-public-paper`}>
      <JournalJsonLd data={buildBlogPostingJsonLd(post, { imageUrl: structuredImage })} />
      <JournalJsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Citius Holidays", url: SITE_URL },
          { name: JOURNAL_NAME, url: `${SITE_URL}/blog` },
          { name: post.title, url: journalPostUrl(slug) },
        ])}
      />

      <header className="bg-public-night pt-32 pb-14 text-white lg:pt-40 lg:pb-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb">
            <Link
              className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-full px-2 font-semibold text-sm text-white/85 transition-colors duration-200 hover:text-white focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-2"
              href="/blog"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              {JOURNAL_NAME}
            </Link>
          </nav>
          <h1 className="font-(family-name:--font-journal) mt-8 max-w-[22ch] text-balance font-medium text-[2.5rem] text-white leading-[1.04] tracking-[-0.015em] sm:text-6xl lg:text-[4.5rem]">
            {post.title}
          </h1>
          {standfirst ? (
            <p className="font-(family-name:--font-journal) mt-6 max-w-[52ch] text-pretty text-white/85 text-xl leading-[1.5] sm:text-[1.375rem]">
              {standfirst}
            </p>
          ) : null}
          <div className="mt-10 flex flex-wrap items-center gap-x-10 gap-y-4">
            <JournalByline author={post.author} tone="night" />
            <div className="text-white/75">
              <JournalMeta post={post} />
              {updatedAt ? (
                <p className="mt-1 text-sm">
                  Updated <time dateTime={updatedAt}>{formatJournalDate(updatedAt)}</time>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {hasCover ? (
        <figure className="mx-auto flex max-w-5xl justify-center px-4 pt-12 sm:px-6 lg:px-8 lg:pt-16">
          <JournalPlate
            alt={getImageAlt(post.mainImage, post.title)}
            className="public-media-edge"
            image={post.mainImage}
            maxHeightClass="max-h-[80svh]"
            priority
            sizes="(max-width: 1023px) 100vw, 976px"
            width={1600}
          />
        </figure>
      ) : null}

      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-[39rem]">
          {Array.isArray(post.body) && post.body.length > 0 ? (
            <JournalPortableText postTitle={post.title} value={post.body} />
          ) : (
            <p className="text-lg text-public-ink">This story has no text yet.</p>
          )}

          {categories.length > 0 ? (
            <p className="mt-12 text-public-muted text-sm">Filed under {categories.join(", ")}</p>
          ) : null}

          <RelatedTrail slug={post.relatedTrail} />
          <AuthorNote author={post.author} />

          <p className="mt-14">
            <Link
              className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-full px-2 font-semibold text-public-blue transition-colors duration-200 hover:text-public-ink focus-visible:outline-2 focus-visible:outline-public-orange-ink focus-visible:outline-offset-2"
              href="/blog"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              All stories in the {JOURNAL_NAME}
            </Link>
          </p>
        </div>
      </div>

      <MoreFromJournal posts={post.more} />
      <JournalTalkToTeam />
    </article>
  );
}
