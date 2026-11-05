import { ArrowRight } from "lucide-react";
import Link from "next/link";
import JournalByline from "@/components/blog/JournalByline";
import JournalMeta from "@/components/blog/JournalMeta";
import JournalPlate from "@/components/blog/JournalPlate";
import JournalTalkToTeam from "@/components/blog/JournalTalkToTeam";
import {
  formatJournalDate,
  getExcerpt,
  getImageAlt,
  getJournalDate,
  groupPostsByYear,
  JOURNAL_NAME,
  splitJournalIndex,
} from "@/components/blog/journalContent";
import { journalFont } from "@/components/blog/journalFont";
import { cachedSanityFetch } from "@/sanity/cachedFetch";

// Every published story: the Journal is small, so the index shows the latest twelve in full and
// lists the rest as an archive instead of paginating.
const POSTS_QUERY = `*[
   _type == "post"
   && defined(slug.current)
]|order(coalesce(publishedAt, _createdAt) desc){
  _id,
  _createdAt,
  title,
  slug,
  publishedAt,
  excerpt,
  mainImage,
  "wordCount": length(string::split(pt::text(body), " ")),
  "body": body[_type == "block"][0...4]{_type, style, children[]{text}},
  author->{name, role, office, image}
}`;

const JOURNAL_INTRO =
  "Field notes from the directors and planners of Citius Holidays: pilgrimage routes, group journeys, and the conferences and incentives we run for companies.";

export const metadata = {
  alternates: { canonical: "https://www.citiusholidays.com/blog" },
  description: JOURNAL_INTRO,
  openGraph: {
    description: JOURNAL_INTRO,
    title: JOURNAL_NAME,
    type: "website",
    url: "https://www.citiusholidays.com/blog",
  },
  title: JOURNAL_NAME,
};

const STRETCHED_LINK =
  "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-public-orange-ink focus-visible:after:outline-offset-4";

function LeadStory({ post }) {
  const excerpt = getExcerpt(post);
  const hasPlate = Boolean(post.mainImage?.asset);
  return (
    <article
      aria-labelledby="journal-lead-title"
      className="group relative grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-12"
    >
      <div className={hasPlate ? "lg:col-span-7" : "lg:col-span-10"}>
        <h2
          className="font-(family-name:--font-journal) max-w-[20ch] text-balance font-medium text-[2.5rem] text-public-ink leading-[1.04] tracking-[-0.015em] sm:text-5xl lg:text-[4rem]"
          id="journal-lead-title"
        >
          <Link
            className={`transition-colors duration-200 group-hover:text-public-blue ${STRETCHED_LINK}`}
            href={`/blog/${post.slug.current}`}
          >
            {post.title}
          </Link>
        </h2>
        {excerpt ? (
          <p className="font-(family-name:--font-journal) mt-6 max-w-[52ch] text-pretty text-public-ink text-xl leading-[1.5] sm:text-[1.375rem]">
            {excerpt}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
          <JournalByline author={post.author} />
          <JournalMeta className="text-public-muted" post={post} />
        </div>
        <span
          aria-hidden="true"
          className="mt-8 inline-flex items-center gap-2 font-semibold text-public-blue"
        >
          Read the story
          <ArrowRight className="size-4 transition-transform duration-200 fine-hover:group-hover:translate-x-1 motion-reduce:transition-none" />
        </span>
      </div>
      {hasPlate ? (
        <div className="flex justify-center lg:col-span-5 lg:justify-end">
          <JournalPlate
            alt={getImageAlt(post.mainImage)}
            className="public-media-edge"
            image={post.mainImage}
            maxHeightClass="max-h-[36rem]"
            priority
            sizes="(max-width: 1023px) 100vw, 40vw"
            width={1200}
          />
        </div>
      ) : null}
    </article>
  );
}

function ContentsEntry({ post }) {
  const excerpt = getExcerpt(post, 150);
  const hasPlate = Boolean(post.mainImage?.asset);
  return (
    <li>
      <article className="group relative grid gap-6 sm:grid-cols-[minmax(0,1fr)_13rem] sm:items-start sm:gap-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="sm:order-1">
          <h3 className="font-(family-name:--font-journal) max-w-[26ch] text-balance font-medium text-[1.75rem] text-public-ink leading-[1.12] sm:text-[2rem]">
            <Link
              className={`transition-colors duration-200 group-hover:text-public-blue ${STRETCHED_LINK}`}
              href={`/blog/${post.slug.current}`}
            >
              {post.title}
            </Link>
          </h3>
          {excerpt ? (
            <p className="mt-3 max-w-[60ch] text-pretty text-base text-public-ink/85 leading-relaxed">
              {excerpt}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-public-muted text-sm">
            {post.author?.name ? <span>{post.author.name}</span> : null}
            {post.author?.name ? (
              <span aria-hidden="true" className="size-1 rounded-full bg-current opacity-60" />
            ) : null}
            <JournalMeta post={post} />
          </div>
        </div>
        {hasPlate ? (
          <div className="sm:order-2 sm:flex sm:justify-end">
            <JournalPlate
              alt={getImageAlt(post.mainImage)}
              className="public-media-edge"
              image={post.mainImage}
              maxHeightClass="max-h-64 sm:max-h-52"
              sizes="(max-width: 639px) 100vw, 272px"
              width={720}
            />
          </div>
        ) : null}
      </article>
    </li>
  );
}

function Archive({ posts }) {
  return (
    <section aria-labelledby="journal-archive-title" className="mt-24 lg:mt-32">
      <h2
        className="font-(family-name:--font-journal) font-medium text-3xl text-public-ink sm:text-4xl"
        id="journal-archive-title"
      >
        Earlier stories
      </h2>
      <div className="mt-8 grid gap-10 md:grid-cols-2">
        {groupPostsByYear(posts).map((group) => (
          <section aria-labelledby={`journal-archive-${group.year}`} key={group.year}>
            <h3
              className="font-semibold text-public-muted text-sm tabular-nums"
              id={`journal-archive-${group.year}`}
            >
              {group.year}
            </h3>
            <ul className="mt-3 space-y-3">
              {group.items.map((post) => {
                const date = getJournalDate(post);
                return (
                  <li
                    className="flex flex-wrap items-baseline justify-between gap-x-6"
                    key={post._id}
                  >
                    <Link
                      className="font-(family-name:--font-journal) text-lg text-public-ink underline-offset-4 hover:text-public-blue hover:underline focus-visible:outline-2 focus-visible:outline-public-orange-ink focus-visible:outline-offset-2"
                      href={`/blog/${post.slug.current}`}
                    >
                      {post.title}
                    </Link>
                    {date ? (
                      <time className="text-public-muted text-sm tabular-nums" dateTime={date}>
                        {formatJournalDate(date)}
                      </time>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}

export default async function JournalIndexPage() {
  const posts = await cachedSanityFetch(POSTS_QUERY, {}, ["blog"]);
  const { archive, contents, lead } = splitJournalIndex(posts);

  return (
    <div className={`${journalFont.variable} bg-public-paper`}>
      <header className="bg-public-night pt-36 pb-16 text-white lg:pt-44 lg:pb-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-12 lg:items-end lg:px-8">
          <h1 className="font-(family-name:--font-journal) font-medium text-[3.75rem] leading-[0.95] tracking-[-0.025em] sm:text-8xl lg:col-span-8 lg:text-[7.5rem]">
            {JOURNAL_NAME}
          </h1>
          <p className="max-w-[44ch] text-pretty text-lg text-white/85 leading-relaxed lg:col-span-4 lg:justify-self-end">
            {JOURNAL_INTRO}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        {lead ? (
          <LeadStory post={lead} />
        ) : (
          <section aria-labelledby="journal-empty-title" className="max-w-2xl">
            <h2
              className="font-(family-name:--font-journal) font-medium text-4xl text-public-ink"
              id="journal-empty-title"
            >
              The first story is on its way
            </h2>
            <p className="mt-4 text-lg text-public-ink/85 leading-relaxed">
              Our directors write here when they have something worth sharing from the road.
            </p>
          </section>
        )}

        {contents.length > 0 ? (
          <section aria-labelledby="journal-contents-title" className="mt-24 lg:mt-36">
            <h2
              className="font-(family-name:--font-journal) font-medium text-3xl text-public-ink sm:text-4xl"
              id="journal-contents-title"
            >
              More from the Journal
            </h2>
            <ul className="mt-10 space-y-16 lg:space-y-20">
              {contents.map((post) => (
                <ContentsEntry key={post._id} post={post} />
              ))}
            </ul>
          </section>
        ) : null}

        {archive.length > 0 ? <Archive posts={archive} /> : null}
      </div>

      <JournalTalkToTeam />
    </div>
  );
}
