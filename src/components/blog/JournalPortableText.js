import { PortableText } from "@portabletext/react";
import Image from "next/image";
import { safePublicHref } from "@/lib/publicHref";
import { cleanText, getImageAlt, getPlateImage, withoutRepeatedTitle } from "./journalContent";

const HEADING_SPACE = "mt-14 mb-4 text-balance font-(family-name:--font-journal) text-public-ink";

function createComponents(postTitle) {
  return {
    block: {
      blockquote: ({ children }) => (
        <blockquote className="font-(family-name:--font-journal) my-10 border-public-orange-ink border-l-4 pl-6 text-[1.375rem] text-public-ink italic leading-[1.45]">
          {children}
        </blockquote>
      ),
      // Editors sometimes use H1 inside the body; the page title is the only h1.
      h1: ({ children }) => (
        <h2 className={`${HEADING_SPACE} font-medium text-3xl leading-tight md:text-[2.125rem]`}>
          {children}
        </h2>
      ),
      h2: ({ children }) => (
        <h2 className={`${HEADING_SPACE} font-medium text-3xl leading-tight md:text-[2.125rem]`}>
          {children}
        </h2>
      ),
      h3: ({ children }) => (
        <h3 className={`${HEADING_SPACE} font-medium text-2xl leading-snug`}>{children}</h3>
      ),
      h4: ({ children }) => (
        <h4 className="mt-10 mb-3 font-semibold text-lg text-public-ink">{children}</h4>
      ),
      normal: ({ children }) => <p className="mt-6 text-pretty first:mt-0">{children}</p>,
    },
    list: {
      bullet: ({ children }) => (
        <ul className="mt-6 list-disc space-y-2 pl-6 marker:text-public-orange-ink">{children}</ul>
      ),
      number: ({ children }) => (
        <ol className="mt-6 list-decimal space-y-2 pl-6 marker:text-public-muted">{children}</ol>
      ),
    },
    listItem: {
      bullet: ({ children }) => <li className="pl-1">{children}</li>,
      number: ({ children }) => <li className="pl-1">{children}</li>,
    },
    marks: {
      em: ({ children }) => <em>{children}</em>,
      link: ({ children, value }) => {
        const href = safePublicHref(value?.href);
        if (!href) {
          return <span>{children}</span>;
        }
        return (
          <a
            className="text-public-blue underline decoration-[0.07em] underline-offset-[0.18em] transition-colors duration-200 hover:text-public-orange-ink focus-visible:outline-2 focus-visible:outline-public-orange-ink focus-visible:outline-offset-2"
            href={href}
            rel={value?.blank ? "noopener noreferrer" : undefined}
            target={value?.blank ? "_blank" : undefined}
          >
            {children}
          </a>
        );
      },
      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    },
    types: {
      image: ({ value }) => {
        const plate = getPlateImage(value, 1400);
        if (!plate) {
          return null;
        }
        const caption = cleanText(value?.caption);
        return (
          <figure className="my-12">
            <Image
              alt={getImageAlt(value, postTitle)}
              className="public-media-edge mx-auto h-auto max-h-[80svh] w-auto max-w-full"
              height={plate.height}
              sizes="(max-width: 767px) 100vw, 720px"
              src={plate.src}
              width={plate.width}
            />
            {caption ? (
              <figcaption className="mt-3 font-sans text-public-muted text-sm leading-relaxed">
                {caption}
              </figcaption>
            ) : null}
          </figure>
        );
      },
    },
  };
}

/** The story body, set for long reading: full ink, 18–20px, 1.6 leading, about 68 characters a line. */
export default function JournalPortableText({ postTitle, value }) {
  return (
    <div className="font-(family-name:--font-journal) max-w-[68ch] text-[1.125rem] text-public-ink leading-[1.6] sm:text-[1.25rem]">
      <PortableText
        components={createComponents(postTitle)}
        value={withoutRepeatedTitle(value, postTitle)}
      />
    </div>
  );
}
