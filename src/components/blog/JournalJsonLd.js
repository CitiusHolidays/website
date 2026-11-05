import { serializeJsonLd } from "./journalContent";

/** Structured data as recommended by the Next.js JSON-LD guide, with "<" escaped. */
export default function JournalJsonLd({ data }) {
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: serializeJsonLd escapes "<" so CMS text cannot close the script element.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
      type="application/ld+json"
    />
  );
}
